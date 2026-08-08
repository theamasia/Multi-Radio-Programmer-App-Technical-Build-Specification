/**
 * Frequency codec for the DM-32UV / DP570UV codeplug.
 *
 * Frequencies are stored as four bytes of packed BCD, least significant byte
 * first, holding eight decimal digits in units of 10 Hz. The bytes
 * `50 12 00 43` read back as the digits `43001250`, which is 430.01250 MHz.
 *
 * This was derived from the factory image rather than documentation: reading
 * the same bytes as a little-endian integer or as IEEE-754 float produces
 * frequencies no amateur radio would ship with, while the BCD reading yields
 * defaults that land squarely in the 2 m and 70 cm bands.
 */

export class CodeplugFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodeplugFormatError';
  }
}

/** Number of BCD bytes in a stored frequency. */
const FREQUENCY_BYTES = 4;

/** Each stored count represents 10 Hz. */
const UNIT_HZ = 10;

/**
 * Decodes a packed-BCD frequency to Hz.
 *
 * Returns `null` when any nibble is not a decimal digit. Unused channel slots
 * are filled with `0xff`, so a non-decimal nibble means "no frequency here"
 * rather than a corrupt read, and callers should treat it as an empty slot.
 */
export function decodeFrequency(bytes: Uint8Array): number | null {
  if (bytes.length !== FREQUENCY_BYTES) {
    throw new CodeplugFormatError(
      `A frequency is ${FREQUENCY_BYTES} bytes, got ${bytes.length}.`,
    );
  }

  let digits = 0;
  // Most significant byte last, so walk backwards.
  for (let i = FREQUENCY_BYTES - 1; i >= 0; i--) {
    const byte = bytes[i] as number;
    const high = byte >> 4;
    const low = byte & 0x0f;
    if (high > 9 || low > 9) return null;
    digits = digits * 100 + high * 10 + low;
  }
  return digits * UNIT_HZ;
}

/**
 * Encodes a frequency in Hz back to packed BCD.
 *
 * Exact by construction: the value must be a whole number of 10 Hz steps and
 * must fit in eight digits. A frequency that cannot be represented is rejected
 * rather than rounded, because silently shifting a transmit frequency is the
 * kind of error that puts a station out of band.
 */
export function encodeFrequency(hz: number): Uint8Array {
  if (!Number.isInteger(hz) || hz < 0) {
    throw new CodeplugFormatError(`Frequency must be a non-negative integer in Hz, got ${hz}.`);
  }
  if (hz % UNIT_HZ !== 0) {
    throw new CodeplugFormatError(
      `Frequency ${hz} Hz is not a whole number of ${UNIT_HZ} Hz steps, so it cannot be ` +
        'stored exactly. Refusing to round a frequency.',
    );
  }

  let digits = hz / UNIT_HZ;
  if (digits > 99999999) {
    throw new CodeplugFormatError(`Frequency ${hz} Hz needs more than eight BCD digits.`);
  }

  const out = new Uint8Array(FREQUENCY_BYTES);
  for (let i = 0; i < FREQUENCY_BYTES; i++) {
    const low = digits % 10;
    digits = (digits - low) / 10;
    const high = digits % 10;
    digits = (digits - high) / 10;
    out[i] = (high << 4) | low;
  }
  return out;
}
