/**
 * An in-memory DM-32UV emulator implementing SerialTransport.
 *
 * Lets the entire connect / program-mode / address-map / read sequence run in
 * CI with no hardware, and lets failure modes (wrong model, NAK, silence) be
 * tested deterministically -- which is exactly what cannot be done safely
 * against a real radio.
 */

import type { SerialOptions, SerialTransport } from '../../src/main/drivers/IRadioDriver.js';
import { PAGE_SIZE } from '../../src/main/drivers/baofeng-dm32uv/constants.js';
import {
  decodeAddress24,
  decodeUint16LE,
  encodeAscii,
} from '../../src/main/drivers/baofeng-dm32uv/frames.js';

export interface FakeRadioOptions {
  readonly modelId?: string;
  readonly firmwareVersion?: string;
  /** Physical page base -> virtual page index stored in the page's last byte. */
  readonly pageLayout?: ReadonlyMap<number, number>;
  readonly codeplugStart?: number;
  readonly codeplugEnd?: number;
  /** Fail detection this many times before succeeding, to exercise retries. */
  readonly failDetectAttempts?: number;
  readonly nakEnterProgramMode?: boolean;
}

export class FakeRadio implements SerialTransport {
  readonly opened: SerialOptions[] = [];
  readonly signalHistory: { dtr?: boolean; rts?: boolean }[] = [];
  closed = false;

  private outbound: number[] = [];
  private detectAttempts = 0;
  private readonly modelId: string;
  private readonly firmwareVersion: string;
  private readonly codeplugStart: number;
  private readonly codeplugEnd: number;
  private readonly failDetectAttempts: number;
  private readonly nakEnterProgramMode: boolean;
  private readonly pageLayout: ReadonlyMap<number, number>;

  constructor(options: FakeRadioOptions = {}) {
    this.modelId = options.modelId ?? 'DP570UV';
    this.firmwareVersion = options.firmwareVersion ?? 'DM32.01.L01.048';
    this.codeplugStart = options.codeplugStart ?? 0x000000;
    this.codeplugEnd = options.codeplugEnd ?? 0x003000;
    this.failDetectAttempts = options.failDetectAttempts ?? 0;
    this.nakEnterProgramMode = options.nakEnterProgramMode ?? false;
    this.pageLayout =
      options.pageLayout ??
      // Virtual indices start at 1: index 0 is a sentinel meaning "unallocated".
      new Map([
        [0x000000, 0x01],
        [0x001000, 0x02],
        [0x002000, 0x03],
      ]);
  }

  async open(options: SerialOptions): Promise<void> {
    this.opened.push(options);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async flush(): Promise<void> {
    this.outbound = [];
  }

  async setSignals(signals: { readonly dtr?: boolean; readonly rts?: boolean }): Promise<void> {
    this.signalHistory.push({ ...signals });
  }

  async read(length: number, _timeoutMs: number): Promise<Uint8Array> {
    if (this.outbound.length < length) {
      throw new Error(
        `Serial read timed out: expected ${length} bytes, received ${this.outbound.length}`,
      );
    }
    return new Uint8Array(this.outbound.splice(0, length));
  }

  async write(data: Uint8Array): Promise<void> {
    const text = String.fromCharCode(...data);

    if (text === 'PSEARCH') return this.handleDetect();
    if (text === 'PASSSTA') return this.push([0x50, 0x00, 0x00]);
    if (text === 'SYSINFO') return this.push([0x06]);
    if (data[0] === 0x56 && data.length === 5) return this.handleValue(data[4] as number);
    if (data.length === 12 && data[0] === 0xff) {
      return this.push([this.nakEnterProgramMode ? 0xc0 : 0x06]);
    }
    if (data.length === 1 && data[0] === 0x02) return this.push([0, 0, 0, 0, 0, 0, 0, 0]);
    if (data.length === 1 && data[0] === 0x06) return this.push([0x06]);
    if (data[0] === 0x52 && data.length === 6) return this.handleRead(data);

    throw new Error(`FakeRadio received an unrecognized frame: ${[...data].join(',')}`);
  }

  private handleDetect(): void {
    this.detectAttempts++;
    if (this.detectAttempts <= this.failDetectAttempts) return; // stay silent
    this.push([0x06, ...encodeAscii(this.modelId.padEnd(7, '\0'))]);
  }

  private handleValue(valueId: number): void {
    if (valueId === 0x01) {
      const payload = [...encodeAscii(this.firmwareVersion)];
      this.push([0x56, 0x01, payload.length, ...payload]);
      return;
    }
    if (valueId === 0x0a || valueId === 0x0f) {
      const start = valueId === 0x0a ? this.codeplugStart : 0x100000;
      const end = valueId === 0x0a ? this.codeplugEnd : 0x200000;
      this.push([0x56, valueId, 8, ...u32(start), ...u32(end)]);
      return;
    }
    throw new Error(`FakeRadio has no value 0x${valueId.toString(16)}`);
  }

  private handleRead(frame: Uint8Array): void {
    const address = decodeAddress24(frame, 1);
    const length = decodeUint16LE(frame, 4);
    const payload: number[] = [];

    for (let i = 0; i < length; i++) {
      const addr = address + i;
      const pageBase = addr - (addr % PAGE_SIZE);
      if (addr % PAGE_SIZE === PAGE_SIZE - 1) {
        payload.push(this.pageLayout.get(pageBase) ?? 0xff);
      } else {
        // Deterministic filler so assembled images are verifiable.
        payload.push(((pageBase >>> 12) ^ (addr & 0xff)) & 0xff);
      }
    }

    this.push([
      0x57,
      frame[1] as number,
      frame[2] as number,
      frame[3] as number,
      length & 0xff,
      (length >>> 8) & 0xff,
      ...payload,
    ]);
  }

  private push(bytes: readonly number[]): void {
    this.outbound.push(...bytes);
  }
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}
