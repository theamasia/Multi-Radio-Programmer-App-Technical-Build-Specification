import { SerialPort } from 'serialport';
import type { SerialOptions, SerialTransport } from '../drivers/IRadioDriver.js';
import { describePort, type DetectedPort } from './portDetection.js';

/** Thrown when a read does not complete within its deadline. */
export class SerialTimeoutError extends Error {
  constructor(expected: number, received: number, timeoutMs: number) {
    super(
      `Serial read timed out after ${timeoutMs}ms: expected ${expected} bytes, received ${received}. ` +
        'Check that the cable is seated, the radio is powered on, and the volume knob is at roughly 50%.',
    );
    this.name = 'SerialTimeoutError';
  }
}

export async function listPorts(): Promise<readonly DetectedPort[]> {
  const ports = await SerialPort.list();
  return ports.map((p) =>
    describePort({
      path: p.path,
      vendorId: p.vendorId,
      productId: p.productId,
      manufacturer: p.manufacturer,
    }),
  );
}

/**
 * Serial transport backed by node-serialport.
 *
 * Inbound bytes accumulate in an internal buffer so `read(n)` can satisfy
 * exact-length reads regardless of how the OS chunks the stream. Radio
 * protocols are strictly length-prefixed or fixed-block, so exact reads are
 * what every driver actually needs.
 */
export class NodeSerialTransport implements SerialTransport {
  private port: SerialPort | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private waiter: (() => void) | null = null;

  constructor(private readonly path: string) {}

  async open(options: SerialOptions): Promise<void> {
    if (this.port) throw new Error(`Port ${this.path} is already open`);
    const port = new SerialPort({
      path: this.path,
      baudRate: options.baudRate,
      dataBits: options.dataBits ?? 8,
      stopBits: options.stopBits ?? 1,
      parity: options.parity ?? 'none',
      autoOpen: false,
    });

    port.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.waiter?.();
    });

    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });
    this.port = port;
  }

  async close(): Promise<void> {
    const port = this.port;
    if (!port) return;
    this.port = null;
    this.buffer = Buffer.alloc(0);
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }

  async write(data: Uint8Array): Promise<void> {
    const port = this.requirePort();
    await new Promise<void>((resolve, reject) => {
      port.write(Buffer.from(data), (err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      port.drain((err) => (err ? reject(err) : resolve()));
    });
  }

  async read(length: number, timeoutMs: number): Promise<Uint8Array> {
    this.requirePort();
    const deadline = Date.now() + timeoutMs;

    while (this.buffer.length < length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new SerialTimeoutError(length, this.buffer.length, timeoutMs);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(finish, remaining);
        this.waiter = finish;
        function finish(): void {
          clearTimeout(timer);
          resolve();
        }
      });
      this.waiter = null;
    }

    const out = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return new Uint8Array(out);
  }

  async flush(): Promise<void> {
    this.buffer = Buffer.alloc(0);
  }

  private requirePort(): SerialPort {
    if (!this.port) throw new Error(`Port ${this.path} is not open`);
    return this.port;
  }
}
