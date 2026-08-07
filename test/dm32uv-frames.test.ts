import { describe, expect, it } from 'vitest';
import {
  decodeAddress24,
  decodeMemoryRegion,
  decodeReadResponseHeader,
  decodeUint32LE,
  decodeValueResponseHeader,
  encodeAddress24,
  encodeReadRequest,
  encodeValueRequest,
  encodeWriteRequest,
  planTransfer,
  ProtocolError,
} from '../src/main/drivers/baofeng-dm32uv/frames.js';

describe('24-bit address encoding', () => {
  /**
   * This is the assertion that settles the documented byte-order dispute.
   * qdmr packs address[0] = addr & 0xff, so 0x008027 must serialize as
   * 27 80 00 -- least significant byte first.
   */
  it('encodes little-endian, least significant byte first', () => {
    expect([...encodeAddress24(0x008027)]).toEqual([0x27, 0x80, 0x00]);
  });

  it('round-trips across the full 24-bit range', () => {
    for (const address of [0x000000, 0x000001, 0x0000ff, 0x001000, 0x123456, 0xffffff]) {
      expect(decodeAddress24(encodeAddress24(address))).toBe(address);
    }
  });

  it('rejects addresses beyond 24 bits', () => {
    expect(() => encodeAddress24(0x1000000)).toThrow(ProtocolError);
    expect(() => encodeAddress24(-1)).toThrow(ProtocolError);
    expect(() => encodeAddress24(1.5)).toThrow(ProtocolError);
  });

  it('throws rather than returning garbage on a short buffer', () => {
    expect(() => decodeAddress24(new Uint8Array([0x01, 0x02]))).toThrow(ProtocolError);
  });
});

describe('read request framing', () => {
  it("emits 'R', little-endian address, little-endian length", () => {
    expect([...encodeReadRequest(0x001000, 0x1000)]).toEqual([
      0x52, 0x00, 0x10, 0x00, 0x00, 0x10,
    ]);
  });

  it('rejects a length beyond one page', () => {
    expect(() => encodeReadRequest(0, 0x1001)).toThrow(ProtocolError);
    expect(() => encodeReadRequest(0, 0)).toThrow(ProtocolError);
  });
});

describe('write request framing', () => {
  it("emits 'W', address, length, then payload", () => {
    const frame = encodeWriteRequest(0x002000, new Uint8Array([0xaa, 0xbb]));
    expect([...frame]).toEqual([0x57, 0x00, 0x20, 0x00, 0x02, 0x00, 0xaa, 0xbb]);
  });
});

describe('value request framing', () => {
  it("emits 'V', three reserved zeros, then the value id", () => {
    expect([...encodeValueRequest(0x0a)]).toEqual([0x56, 0x00, 0x00, 0x00, 0x0a]);
  });
});

describe('value response header', () => {
  it('parses type, value id, and payload length', () => {
    expect(decodeValueResponseHeader(new Uint8Array([0x56, 0x0a, 0x08]))).toEqual({
      valueId: 0x0a,
      payloadLength: 8,
    });
  });

  it('rejects a wrong response type', () => {
    expect(() => decodeValueResponseHeader(new Uint8Array([0x57, 0x0a, 0x08]))).toThrow(
      /expected value response type/i,
    );
  });
});

describe('memory region decoding', () => {
  it('reads two little-endian uint32 bounds', () => {
    const payload = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x0c, 0x00]);
    expect(decodeMemoryRegion(payload)).toEqual({ startAddress: 0, endAddress: 0x0c8000 });
  });

  it('rejects a region whose end precedes its start', () => {
    const payload = new Uint8Array([0x00, 0x80, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() => decodeMemoryRegion(payload)).toThrow(/invalid memory region/i);
  });

  it('decodes uint32 values above 2^31 without sign errors', () => {
    expect(decodeUint32LE(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffff);
  });
});

describe('read response header', () => {
  it("accepts the 'W' response type used for returned data", () => {
    const header = new Uint8Array([0x57, 0x00, 0x10, 0x00, 0x00, 0x10]);
    expect(decodeReadResponseHeader(header)).toEqual({
      address: 0x001000,
      payloadLength: 0x1000,
    });
  });

  it("rejects an 'R' response type", () => {
    const header = new Uint8Array([0x52, 0x00, 0x10, 0x00, 0x00, 0x10]);
    expect(() => decodeReadResponseHeader(header)).toThrow(/expected read response type/i);
  });
});

describe('transfer planning', () => {
  it('issues a single chunk for an aligned full page', () => {
    expect(planTransfer(0x1000, 0x1000)).toEqual([{ address: 0x1000, length: 0x1000 }]);
  });

  it('trims the first chunk to reach page alignment', () => {
    expect(planTransfer(0x1ffc, 8)).toEqual([
      { address: 0x1ffc, length: 4 },
      { address: 0x2000, length: 4 },
    ]);
  });

  it('never lets a chunk straddle a page boundary', () => {
    for (const chunk of planTransfer(0x0abc, 0x5000)) {
      const startPage = Math.floor(chunk.address / 0x1000);
      const endPage = Math.floor((chunk.address + chunk.length - 1) / 0x1000);
      expect(startPage).toBe(endPage);
    }
  });

  it('covers exactly the requested byte range', () => {
    const chunks = planTransfer(0x0abc, 0x5000);
    expect(chunks.reduce((sum, c) => sum + c.length, 0)).toBe(0x5000);
    expect(chunks[0]?.address).toBe(0x0abc);
  });
});
