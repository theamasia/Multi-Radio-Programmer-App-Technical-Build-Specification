/**
 * Pure encoders and decoders for DM-32UV protocol frames.
 *
 * Deliberately free of I/O so the wire format is exhaustively unit-testable
 * without a radio or even a mock transport. Every multi-byte integer in this
 * protocol is little-endian; this was confirmed against qdmr's packing code
 * (`address[0] = (addr >> 0) & 0xff`) rather than inferred from documentation,
 * because two upstream sources disagreed on it.
 */

import { PAGE_SIZE, REQUEST, RESPONSE, VALUE_ID } from './constants.js';

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

const MAX_ADDRESS = 0xffffff;

function assertAddress(address: number): void {
  if (!Number.isInteger(address) || address < 0 || address > MAX_ADDRESS) {
    throw new ProtocolError(
      `Address must be an integer in 0x000000-0xffffff, got ${address}`,
    );
  }
}

function assertLength(length: number): void {
  if (!Number.isInteger(length) || length < 1 || length > PAGE_SIZE) {
    throw new ProtocolError(
      `Transfer length must be an integer in 1-${PAGE_SIZE}, got ${length}`,
    );
  }
}

/** Encodes a 24-bit address little-endian (least significant byte first). */
export function encodeAddress24(address: number): Uint8Array {
  assertAddress(address);
  return new Uint8Array([
    address & 0xff,
    (address >>> 8) & 0xff,
    (address >>> 16) & 0xff,
  ]);
}

/** Decodes a 24-bit little-endian address from `bytes` at `offset`. */
export function decodeAddress24(bytes: Uint8Array, offset = 0): number {
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  if (b0 === undefined || b1 === undefined || b2 === undefined) {
    throw new ProtocolError(
      `Cannot decode 24-bit address: need 3 bytes at offset ${offset}, buffer has ${bytes.length}`,
    );
  }
  return b0 | (b1 << 8) | (b2 << 16);
}

export function encodeUint16LE(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

export function decodeUint16LE(bytes: Uint8Array, offset = 0): number {
  const lo = bytes[offset];
  const hi = bytes[offset + 1];
  if (lo === undefined || hi === undefined) {
    throw new ProtocolError(
      `Cannot decode uint16: need 2 bytes at offset ${offset}, buffer has ${bytes.length}`,
    );
  }
  return lo | (hi << 8);
}

export function decodeUint32LE(bytes: Uint8Array, offset = 0): number {
  const b = [0, 1, 2, 3].map((i) => bytes[offset + i]);
  if (b.some((v) => v === undefined)) {
    throw new ProtocolError(
      `Cannot decode uint32: need 4 bytes at offset ${offset}, buffer has ${bytes.length}`,
    );
  }
  // >>> 0 keeps the result an unsigned 32-bit value.
  return (
    ((b[0] as number) |
      ((b[1] as number) << 8) |
      ((b[2] as number) << 16) |
      ((b[3] as number) << 24)) >>>
    0
  );
}

export function encodeAscii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function decodeAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}

/** Builds a `V`-frame metadata query: 'V', three reserved zero bytes, value ID. */
export function encodeValueRequest(valueId: number): Uint8Array {
  return new Uint8Array([REQUEST.value, 0x00, 0x00, 0x00, valueId]);
}

/** Builds a read request: 'R', 24-bit LE address, 16-bit LE length. */
export function encodeReadRequest(address: number, length: number): Uint8Array {
  assertAddress(address);
  assertLength(length);
  const addr = encodeAddress24(address);
  const len = encodeUint16LE(length);
  return new Uint8Array([REQUEST.read, ...addr, ...len]);
}

/** Builds a write request. Not yet used -- see WRITE-SAFETY in the driver. */
export function encodeWriteRequest(
  address: number,
  payload: Uint8Array,
): Uint8Array {
  assertAddress(address);
  assertLength(payload.length);
  const addr = encodeAddress24(address);
  const len = encodeUint16LE(payload.length);
  const out = new Uint8Array(6 + payload.length);
  out.set([REQUEST.write, ...addr, ...len], 0);
  out.set(payload, 6);
  return out;
}

export interface ValueResponseHeader {
  readonly valueId: number;
  readonly payloadLength: number;
}

/**
 * Parses the 3-byte header of a `V` response. The payload length is only known
 * after reading this, so header and body are decoded separately.
 */
export function decodeValueResponseHeader(
  header: Uint8Array,
): ValueResponseHeader {
  if (header.length < 3) {
    throw new ProtocolError(
      `Value response header must be 3 bytes, got ${header.length}`,
    );
  }
  if (header[0] !== RESPONSE.value) {
    throw new ProtocolError(
      `Expected value response type 0x56 ('V'), got 0x${(header[0] ?? 0)
        .toString(16)
        .padStart(2, '0')}`,
    );
  }
  return {
    valueId: header[1] as number,
    payloadLength: header[2] as number,
  };
}

export interface MemoryRegion {
  /** Inclusive lower bound. */
  readonly startAddress: number;
  /** Inclusive upper bound, per qdmr's ValueResponse::upperMemoryBound. */
  readonly endAddress: number;
}

/** Decodes a memory-region payload: two little-endian uint32 bounds. */
export function decodeMemoryRegion(payload: Uint8Array): MemoryRegion {
  if (payload.length < 8) {
    throw new ProtocolError(
      `Memory region payload must be at least 8 bytes, got ${payload.length}`,
    );
  }
  const startAddress = decodeUint32LE(payload, 0);
  const endAddress = decodeUint32LE(payload, 4);
  if (endAddress <= startAddress) {
    throw new ProtocolError(
      `Radio reported an invalid memory region: 0x${startAddress.toString(16)}-0x${endAddress.toString(16)}`,
    );
  }
  return { startAddress, endAddress };
}

export interface ReadResponse {
  readonly address: number;
  readonly payload: Uint8Array;
}

/**
 * Parses the 6-byte read-response header. Note the type byte is 'W' (0x57),
 * not 'R' -- the radio echoes the write opcode when returning data.
 */
export function decodeReadResponseHeader(header: Uint8Array): {
  readonly address: number;
  readonly payloadLength: number;
} {
  if (header.length < 6) {
    throw new ProtocolError(
      `Read response header must be 6 bytes, got ${header.length}`,
    );
  }
  if (header[0] !== RESPONSE.readData) {
    throw new ProtocolError(
      `Expected read response type 0x57 ('W'), got 0x${(header[0] ?? 0)
        .toString(16)
        .padStart(2, '0')}`,
    );
  }
  return {
    address: decodeAddress24(header, 1),
    payloadLength: decodeUint16LE(header, 4),
  };
}

/**
 * Splits a transfer into page-aligned chunks.
 *
 * The radio addresses flash in 4 KiB pages and rejects transfers that straddle
 * a page boundary, so the first chunk is trimmed to reach alignment and the
 * remainder is issued in full pages.
 */
export function planTransfer(
  address: number,
  totalBytes: number,
): readonly { readonly address: number; readonly length: number }[] {
  assertAddress(address);
  if (!Number.isInteger(totalBytes) || totalBytes < 1) {
    throw new ProtocolError(`Transfer size must be a positive integer, got ${totalBytes}`);
  }

  const chunks: { address: number; length: number }[] = [];
  let cursor = address;
  let remaining = totalBytes;

  const misalignment = cursor % PAGE_SIZE;
  if (misalignment !== 0) {
    const length = Math.min(remaining, PAGE_SIZE - misalignment);
    chunks.push({ address: cursor, length });
    cursor += length;
    remaining -= length;
  }

  while (remaining > 0) {
    const length = Math.min(remaining, PAGE_SIZE);
    chunks.push({ address: cursor, length });
    cursor += length;
    remaining -= length;
  }

  return chunks;
}

export const VALUE_IDS = VALUE_ID;
