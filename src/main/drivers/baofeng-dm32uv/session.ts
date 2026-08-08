/**
 * DM-32UV programming session: connect, identify, discover memory layout, read.
 *
 * WRITE SAFETY: this module intentionally implements no write path. Writing is
 * gated on Phase 3 of the build plan, which requires a verified codeplug dump
 * from real hardware first. `frames.encodeWriteRequest` exists and is tested,
 * but nothing here calls it.
 *
 * Ported from qdmr's `DM32UVInterface` (GPL-3.0,
 * https://github.com/hmatuschek/qdmr).
 */

import type { SerialTransport } from '../IRadioDriver.js';
import {
  COMMAND,
  DELAY,
  DETECT_ATTEMPTS,
  DM32UV_SERIAL,
  ENTER_PROGRAM_MODE,
  EXPECTED_MODEL_ID,
  KNOWN_FIRMWARE_PREFIXES,
  OPCODE,
  PAGE_SIZE,
  UNMAPPED_FILL,
  RESPONSE,
  TIMEOUT_MS,
  UNALLOCATED_PAGE_MARKERS,
  VALUE_ID,
} from './constants.js';
import {
  decodeAscii,
  decodeMemoryRegion,
  decodeReadResponseHeader,
  decodeValueResponseHeader,
  encodeAscii,
  encodeReadRequest,
  encodeValueRequest,
  planTransfer,
  ProtocolError,
  type MemoryRegion,
} from './frames.js';
import { AddressMap } from './AddressMap.js';

export type SessionState =
  | 'closed'
  | 'open'
  | 'systemInfo'
  | 'program'
  | 'error';

export interface RadioIdentity {
  readonly modelId: string;
  readonly firmwareVersion: string;
  readonly codeplugMemory: MemoryRegion;
  readonly callsignMemory: MemoryRegion;
  /** False when the firmware is outside the range this port was built against. */
  readonly firmwareKnown: boolean;
}

export interface SessionLogger {
  debug(message: string): void;
  warn(message: string): void;
}

const silentLogger: SessionLogger = { debug: () => {}, warn: () => {} };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class DM32UVSession {
  private state: SessionState = 'closed';
  private identity: RadioIdentity | null = null;

  constructor(
    private readonly transport: SerialTransport,
    private readonly log: SessionLogger = silentLogger,
    private readonly delay: (ms: number) => Promise<void> = sleep,
  ) {}

  get currentState(): SessionState {
    return this.state;
  }

  get radioIdentity(): RadioIdentity | null {
    return this.identity;
  }

  /**
   * Opens the port and runs the identification handshake.
   *
   * PSEARCH is retried because the USB-serial adapter frequently is not ready
   * to carry traffic the instant the OS reports the port open.
   */
  async connect(): Promise<RadioIdentity> {
    if (this.state !== 'closed') {
      throw new Error(`Cannot connect: session is already ${this.state}`);
    }

    await this.transport.open(DM32UV_SERIAL);
    // RTS low / DTR high, matching the OEM software's line state.
    await this.transport.setSignals({ rts: false, dtr: true });
    this.state = 'open';

    try {
      const modelId = await this.detectModel();
      if (modelId !== EXPECTED_MODEL_ID) {
        throw new ProtocolError(
          `Connected radio reports model "${modelId}", but this driver supports ` +
            `"${EXPECTED_MODEL_ID}" (the DM-32UV's internal model string). ` +
            'Refusing to continue against an unknown radio.',
        );
      }

      await this.delay(DELAY.betweenCommands);
      await this.requestPassword();

      await this.delay(DELAY.betweenCommands);
      await this.enterSystemInfoMode();

      await this.delay(DELAY.betweenCommands);
      const firmwareVersion = decodeAscii(
        await this.readValue(VALUE_ID.firmwareVersion),
      ).replace(/\0+$/, '');

      await this.delay(DELAY.betweenCommands);
      const codeplugMemory = decodeMemoryRegion(
        await this.readValue(VALUE_ID.mainConfigMemory),
      );

      await this.delay(DELAY.betweenCommands);
      const callsignMemory = decodeMemoryRegion(
        await this.readValue(VALUE_ID.callsignDbMemory),
      );

      const firmwareKnown = KNOWN_FIRMWARE_PREFIXES.some((prefix) =>
        firmwareVersion.startsWith(prefix),
      );
      if (!firmwareKnown) {
        this.log.warn(
          `Firmware "${firmwareVersion}" is outside the versions this driver was ` +
            'built against. The memory layout is discovered dynamically, so reads ' +
            'should still work, but treat results as unverified.',
        );
      }

      this.identity = {
        modelId,
        firmwareVersion,
        codeplugMemory,
        callsignMemory,
        firmwareKnown,
      };
      this.state = 'systemInfo';
      this.log.debug(
        `Identified ${modelId} firmware ${firmwareVersion}; codeplug ` +
          `0x${codeplugMemory.startAddress.toString(16)}-0x${codeplugMemory.endAddress.toString(16)}`,
      );
      return this.identity;
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Closes the session. There is no "exit program mode" command, so DTR is
   * cycled low to make the adapter reset the radio -- otherwise it stays in
   * program mode with a frozen display.
   */
  async close(): Promise<void> {
    if (this.state === 'closed') return;
    try {
      if (this.state === 'program' || this.state === 'systemInfo') {
        await this.transport.setSignals({ dtr: false });
        await this.delay(DELAY.resetOnClose);
      }
    } finally {
      await this.transport.close();
      this.state = 'closed';
    }
  }

  /** Enters program mode, which is required before any read. */
  async enterProgramMode(): Promise<void> {
    if (this.state === 'program') return;
    if (this.state !== 'systemInfo') {
      throw new Error(
        `Cannot enter program mode from state "${this.state}"; connect() first`,
      );
    }
    await this.transport.write(ENTER_PROGRAM_MODE);
    await this.expectAck('enter program mode');

    // Undocumented, but the OEM software always sends it and the radio expects
    // it before accepting reads.
    await this.transport.write(new Uint8Array([OPCODE.unknown02]));
    await this.transport.read(8, TIMEOUT_MS);

    await this.transport.write(new Uint8Array([OPCODE.ping]));
    await this.expectAck('ping');

    this.state = 'program';
    this.log.debug('Entered program mode');
  }

  /**
   * Discovers the virtual-to-physical page layout.
   *
   * Each 4 KiB page stores its virtual page index in its own last byte. Probing
   * that byte for every page reconstructs the mapping. 0x00 and 0xff mean the
   * page is unallocated -- see UNALLOCATED_PAGE_MARKERS for why this means
   * virtual page 0 is never mapped.
   */
  async buildAddressMap(
    onProgress?: (percent: number) => void,
  ): Promise<AddressMap> {
    await this.enterProgramMode();
    const identity = this.requireIdentity();
    const { startAddress, endAddress } = identity.codeplugMemory;

    const map = new AddressMap();
    const totalPages = Math.ceil((endAddress - startAddress) / PAGE_SIZE);
    let pagesProbed = 0;

    for (let address = startAddress; address < endAddress; address += PAGE_SIZE) {
      await this.delay(DELAY.betweenMapProbes);
      const marker = await this.readRaw(address + PAGE_SIZE - 1, 1);
      const prefix = marker[0];
      pagesProbed++;
      onProgress?.(Math.round((100 * pagesProbed) / totalPages));

      if (prefix === undefined || UNALLOCATED_PAGE_MARKERS.includes(prefix)) continue;
      map.map(address, prefix << 12);
    }

    this.log.debug(`Mapped ${map.size} of ${totalPages} codeplug pages`);
    return map;
  }

  /**
   * Reads `length` bytes from a physical address, transparently splitting the
   * request across page boundaries.
   */
  async readRaw(address: number, length: number): Promise<Uint8Array> {
    if (this.state !== 'program') await this.enterProgramMode();

    const out = new Uint8Array(length);
    let offset = 0;

    for (const chunk of planTransfer(address, length)) {
      await this.transport.write(encodeReadRequest(chunk.address, chunk.length));
      const header = await this.transport.read(6, TIMEOUT_MS);
      const parsed = decodeReadResponseHeader(header);

      if (parsed.address !== chunk.address) {
        throw new ProtocolError(
          `Radio returned data for address 0x${parsed.address.toString(16)} but ` +
            `0x${chunk.address.toString(16)} was requested. This usually means the ` +
            'address byte order is wrong or the stream is out of sync.',
        );
      }
      if (parsed.payloadLength !== chunk.length) {
        throw new ProtocolError(
          `Radio returned ${parsed.payloadLength} bytes but ${chunk.length} were requested ` +
            `at 0x${chunk.address.toString(16)}.`,
        );
      }

      const payload = await this.transport.read(parsed.payloadLength, TIMEOUT_MS);
      out.set(payload, offset);
      offset += payload.length;
    }

    return out;
  }

  /**
   * Reads the complete codeplug as a virtually-addressed image.
   *
   * Pages are fetched from their physical locations and placed at their virtual
   * offsets, so the result is directly indexable by the offsets that the
   * codeplug structures use.
   */
  async readCodeplugImage(
    onProgress?: (percent: number) => void,
  ): Promise<{ readonly image: Uint8Array; readonly map: AddressMap }> {
    const map = await this.buildAddressMap((p) => onProgress?.(Math.round(p / 2)));

    const virtualPages = map.virtualPages();
    const lastPage = virtualPages[virtualPages.length - 1];
    if (lastPage === undefined) {
      throw new ProtocolError(
        'No codeplug pages were mapped. Confirm the radio is on an analog channel, ' +
          'not charging over USB, and that the cable is fully seated.',
      );
    }

    // No gap check here on purpose. The radio allocates pages dynamically and
    // an unallocated page is the normal case, not a failed read -- most of the
    // address space is empty on a healthy radio. Unallocated pages are filled
    // with UNMAPPED_FILL and reported via map.unmappedVirtualPages() so that
    // nothing downstream mistakes filler for codeplug data.
    const image = new Uint8Array(lastPage + PAGE_SIZE).fill(UNMAPPED_FILL);
    for (let i = 0; i < virtualPages.length; i++) {
      const virtualAddress = virtualPages[i] as number;
      const physicalAddress = map.toPhysical(virtualAddress);
      if (physicalAddress === null) {
        throw new ProtocolError(
          `Virtual page 0x${virtualAddress.toString(16)} lost its physical mapping`,
        );
      }
      const page = await this.readRaw(physicalAddress, PAGE_SIZE);
      image.set(page, virtualAddress);
      onProgress?.(50 + Math.round((50 * (i + 1)) / virtualPages.length));
    }

    return { image, map };
  }

  private requireIdentity(): RadioIdentity {
    if (!this.identity) throw new Error('Radio has not been identified; call connect() first');
    return this.identity;
  }

  private async detectModel(): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= DETECT_ATTEMPTS; attempt++) {
      await this.delay(DELAY.beforeDetect);
      await this.transport.flush();
      try {
        await this.transport.write(encodeAscii(COMMAND.detect));
        const result = await this.transport.read(1, TIMEOUT_MS);
        if (result[0] !== RESPONSE.ack) {
          throw new ProtocolError(
            `Detection returned 0x${(result[0] ?? 0).toString(16)} instead of 0x06`,
          );
        }
        return decodeAscii(await this.transport.read(7, TIMEOUT_MS));
      } catch (error) {
        lastError = error;
        this.log.debug(`Detection attempt ${attempt} of ${DETECT_ATTEMPTS} failed`);
      }
    }

    throw new ProtocolError(
      `Radio did not respond to detection after ${DETECT_ATTEMPTS} attempts. ` +
        `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  private async requestPassword(): Promise<void> {
    await this.transport.write(encodeAscii(COMMAND.password));
    const result = await this.transport.read(1, TIMEOUT_MS);
    if (result[0] !== RESPONSE.password) {
      throw new ProtocolError(
        `Password request returned 0x${(result[0] ?? 0).toString(16)} instead of 0x50. ` +
          'The radio may be configured to require a programming password.',
      );
    }
    // Two further bytes of undocumented data follow and are discarded.
    await this.transport.read(2, TIMEOUT_MS);
  }

  private async enterSystemInfoMode(): Promise<void> {
    await this.transport.write(encodeAscii(COMMAND.sysinfo));
    await this.expectAck('enter system info mode');
  }

  private async readValue(valueId: number): Promise<Uint8Array> {
    await this.transport.write(encodeValueRequest(valueId));
    const header = await this.transport.read(3, TIMEOUT_MS);
    const parsed = decodeValueResponseHeader(header);
    if (parsed.valueId !== valueId) {
      throw new ProtocolError(
        `Requested value 0x${valueId.toString(16)} but radio answered for ` +
          `0x${parsed.valueId.toString(16)}`,
      );
    }
    if (parsed.payloadLength === 0) return new Uint8Array(0);
    return this.transport.read(parsed.payloadLength, TIMEOUT_MS);
  }

  private async expectAck(what: string): Promise<void> {
    const result = await this.transport.read(1, TIMEOUT_MS);
    if (result[0] !== RESPONSE.ack) {
      throw new ProtocolError(
        `Failed to ${what}: radio replied 0x${(result[0] ?? 0).toString(16)}, expected 0x06`,
      );
    }
  }
}
