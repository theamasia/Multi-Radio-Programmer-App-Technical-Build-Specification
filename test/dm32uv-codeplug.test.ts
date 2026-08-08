import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AddressMap } from '../src/main/drivers/baofeng-dm32uv/AddressMap.js';
import { decodeFrequency, encodeFrequency } from '../src/main/drivers/baofeng-dm32uv/codeplug/bcd.js';
import { Codeplug } from '../src/main/drivers/baofeng-dm32uv/codeplug/Codeplug.js';
import {
  ALL_CALL_ID,
  CHANNEL_BANK_FIRST_ID,
} from '../src/main/drivers/baofeng-dm32uv/codeplug/layout.js';

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

describe('Zones parsed from real hardware', () => {
  it('parses the two factory zones and their channel lists', () => {
    const zones = loadFixture().zones();
    expect(zones).toHaveLength(2);
    expect(zones[0]?.name).toBe('Zone 1');
    expect(zones[0]?.channels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(zones[1]?.name).toBe('Func Demo');
    expect(zones[1]?.channels).toEqual([17, 18, 19, 20, 21, 22, 23, 24, 25]);
  });

  it('accounts for exactly the channels that exist', () => {
    // The zones partition the 25 channels with no overlap and nothing left
    // over. An off-by-one in the record stride or the 16-bit channel list
    // would break this, and it is independent of how the channels parse.
    const codeplug = loadFixture();
    const referenced = codeplug.zones().flatMap((zone) => zone.channels);
    expect(new Set(referenced).size).toBe(referenced.length);
    expect([...referenced].sort((a, b) => a - b)).toEqual(
      codeplug.channels().map((_, index) => index + 1),
    );
  });

  it('re-encodes every zone byte-identically', () => {
    const codeplug = loadFixture();
    const before = Uint8Array.from(codeplug.rawImage);
    for (const zone of codeplug.zones()) codeplug.writeZone(zone);
    expect(Buffer.from(codeplug.rawImage).equals(Buffer.from(before))).toBe(true);
  });
});

describe('Contacts parsed from real hardware', () => {
  it('parses the factory contacts including All Call', () => {
    const contacts = loadFixture().contacts();
    expect(contacts).toHaveLength(10);
    expect(contacts[0]?.name).toBe('Contacts 1');
    expect(contacts[0]?.dmrId).toBe(1);
    // The tenth contact carries the DMR broadcast address, which is what
    // identified the 24-bit little-endian ID field in the first place.
    expect(contacts[9]?.dmrId).toBe(ALL_CALL_ID);
  });

  it('re-encodes every contact byte-identically despite 0xff name padding', () => {
    // Contact names are padded with 0xff while channel names are padded with
    // 0x00, in the same image. Normalising either would corrupt the other.
    const codeplug = loadFixture();
    const before = Uint8Array.from(codeplug.rawImage);
    for (const contact of codeplug.contacts()) codeplug.writeContact(contact);
    expect(Buffer.from(codeplug.rawImage).equals(Buffer.from(before))).toBe(true);
  });

  it('rejects a DMR ID that does not fit in 24 bits', () => {
    const codeplug = loadFixture();
    const contact = codeplug.contacts()[0];
    if (contact === undefined) throw new Error('fixture has no contacts');
    expect(() => codeplug.writeContact({ ...contact, dmrId: 0x1000000 })).toThrow(/24 bits/i);
  });
});
