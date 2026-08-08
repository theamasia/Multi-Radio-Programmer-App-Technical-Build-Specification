import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AddressMap } from '../src/main/drivers/baofeng-dm32uv/AddressMap.js';
import { decodeFrequency, encodeFrequency } from '../src/main/drivers/baofeng-dm32uv/codeplug/bcd.js';
import { Codeplug } from '../src/main/drivers/baofeng-dm32uv/codeplug/Codeplug.js';
import { CHANNEL_BANK_FIRST_ID } from '../src/main/drivers/baofeng-dm32uv/codeplug/layout.js';

const FIXTURE_DIR = join(__dirname, 'fixtures');
const IMAGE = join(FIXTURE_DIR, 'dp570uv-factory-codeplug.bin');
const MAP = join(FIXTURE_DIR, 'dp570uv-factory-codeplug.map.json');

interface MapFile {
  readonly pages: readonly { readonly virtual: string; readonly physical: string }[];
}

function loadFixture(): Codeplug {
  const image = new Uint8Array(readFileSync(IMAGE));
  const parsed = JSON.parse(readFileSync(MAP, 'utf8')) as MapFile;
  const map = new AddressMap();
  for (const page of parsed.pages) {
    map.map(Number.parseInt(page.physical, 16), Number.parseInt(page.virtual, 16));
  }
  return new Codeplug(image, map);
}

describe('BCD frequency codec', () => {
  it('decodes the factory bytes for channel 1', () => {
    // 50 12 00 43 -> digits 43001250 -> 430.01250 MHz
    expect(decodeFrequency(new Uint8Array([0x50, 0x12, 0x00, 0x43]))).toBe(430_012_500);
  });

  it('round-trips every 10 Hz step it claims to support', () => {
    for (const hz of [0, 10, 144_022_500, 430_012_500, 439_975_000, 999_999_990]) {
      expect(decodeFrequency(encodeFrequency(hz))).toBe(hz);
    }
  });

  it('treats a non-decimal nibble as an empty slot rather than an error', () => {
    expect(decodeFrequency(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBeNull();
  });

  it('refuses to round a frequency it cannot store exactly', () => {
    // 5 Hz is half a step. Silently rounding this could shift a station out of band.
    expect(() => encodeFrequency(145_000_005)).toThrow(/not a whole number/i);
  });

  it('refuses a frequency needing more than eight digits', () => {
    expect(() => encodeFrequency(9_999_999_990)).toThrow(/eight BCD digits/i);
  });
});

describe('Codeplug parsed from real hardware', () => {
  it('finds the populated channel bank and its channel count', () => {
    const codeplug = loadFixture();
    expect(codeplug.channelCount(CHANNEL_BANK_FIRST_ID)).toBe(25);
  });

  it('parses the factory channels with plausible amateur frequencies', () => {
    const channels = loadFixture().channels();
    expect(channels).toHaveLength(25);

    const first = channels[0];
    expect(first?.name).toBe('Channel 1');
    expect(first?.rxHz).toBe(430_012_500);
    expect(first?.txHz).toBe(430_012_500);

    // Every parsed channel should land in the 2 m or 70 cm band. A decoding
    // error would scatter these across implausible frequencies, which is what
    // reading the same bytes as an integer or float does.
    for (const channel of channels) {
      const mhz = (channel.rxHz ?? 0) / 1e6;
      const inBand = (mhz >= 144 && mhz <= 148) || (mhz >= 420 && mhz <= 450);
      expect(inBand, `${channel.name} decoded to ${mhz} MHz`).toBe(true);
    }
  });

  it('preserves names exactly, including the factory double space', () => {
    const channels = loadFixture().channels();
    expect(channels[2]?.name).toBe('Channel  3');
  });

  it('re-encodes every channel byte-identically', () => {
    // The real risk in a codec is asymmetry: decode and encode disagreeing in
    // padding, digit order or rounding. Writing every parsed channel back
    // unchanged and comparing the whole image catches that, and is the
    // precondition for ever writing to a radio.
    const codeplug = loadFixture();
    const before = Uint8Array.from(codeplug.rawImage);

    for (const channel of codeplug.channels()) {
      codeplug.writeChannel(channel);
    }

    expect(Buffer.from(codeplug.rawImage).equals(Buffer.from(before))).toBe(true);
  });

  it('changes only the bytes of the field it edits', () => {
    const codeplug = loadFixture();
    const before = Uint8Array.from(codeplug.rawImage);
    const original = codeplug.channels()[0];
    if (original === undefined) throw new Error('fixture has no channels');

    codeplug.writeChannel({ ...original, rxHz: 145_500_000 });

    const changed: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== codeplug.rawImage[i]) changed.push(i);
    }
    // Record 0 starts at 0x12010; the rx frequency occupies +0x10..+0x13.
    expect(changed).toEqual([0x12020, 0x12021, 0x12022, 0x12023]);
    expect(codeplug.channels()[0]?.txHz).toBe(430_012_500);
  });

  it('refuses to write into an unallocated page', () => {
    const codeplug = loadFixture();
    const channel = codeplug.channels()[0];
    if (channel === undefined) throw new Error('fixture has no channels');
    // 0x49 is one of the 17 unallocated pages on this radio.
    expect(() => codeplug.writeChannel({ ...channel, bankId: 0x49 })).toThrow(/not allocated/i);
  });
});
