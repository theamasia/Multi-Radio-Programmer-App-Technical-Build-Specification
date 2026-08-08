import { AddressMap } from '../AddressMap.js';
import { PAGE_SIZE } from '../constants.js';
import { CodeplugFormatError, decodeFrequency, encodeFrequency } from './bcd.js';
import {
  BANK_HEADER_COUNT_OFFSET,
  BANK_HEADER_SIZE,
  CHANNEL,
  CHANNEL_BANK_FIRST_ID,
  CHANNEL_BANK_LAST_ID,
  CHANNEL_RECORD_SIZE,
  CHANNELS_PER_BANK,
} from './layout.js';

/** A channel as stored in the codeplug. */
export interface Channel {
  /** Logical block ID of the bank page holding this channel. */
  readonly bankId: number;
  /** Record index within the bank, 0-based. */
  readonly slot: number;
  readonly name: string;
  /** Receive frequency in Hz, or null when the slot stores no valid frequency. */
  readonly rxHz: number | null;
  /** Transmit frequency in Hz, or null when the slot stores no valid frequency. */
  readonly txHz: number | null;
}

/**
 * A parsed codeplug that keeps its original image.
 *
 * The image is the source of truth and edits are applied as patches to it. The
 * driver never regenerates a codeplug from parsed fields, because the vast
 * majority of the image is still undecoded -- regenerating would discard every
 * byte this project does not yet understand. Only the bytes belonging to a
 * changed field are ever modified.
 */
export class Codeplug {
  private readonly image: Uint8Array;
  private readonly map: AddressMap;

  constructor(image: Uint8Array, map: AddressMap) {
    this.image = image;
    this.map = map;
  }

  /** The underlying image. Callers must not mutate it directly. */
  get rawImage(): Uint8Array {
    return this.image;
  }

  /** Whether a virtual page holds real data rather than unallocated filler. */
  private isAllocated(virtualAddress: number): boolean {
    if (virtualAddress + PAGE_SIZE > this.image.length) return false;
    return this.map.toPhysical(virtualAddress) !== null;
  }

  /** Logical block IDs of the channel banks that are allocated on this radio. */
  allocatedChannelBanks(): readonly number[] {
    const banks: number[] = [];
    for (let id = CHANNEL_BANK_FIRST_ID; id <= CHANNEL_BANK_LAST_ID; id++) {
      if (this.isAllocated(id * PAGE_SIZE)) banks.push(id);
    }
    return banks;
  }

  /**
   * Number of channels in use in a bank, taken from its page header.
   *
   * Records past this count are unused slots rather than channels. On the
   * factory image they hold `0xff` names and a placeholder frequency, so
   * trusting the header is what keeps them out of the parsed result.
   */
  channelCount(bankId: number): number {
    const base = bankId * PAGE_SIZE;
    if (!this.isAllocated(base)) return 0;
    const count = this.image[base + BANK_HEADER_COUNT_OFFSET] as number;
    // An unallocated-looking header (0xff) means no usable channels.
    return count > CHANNELS_PER_BANK ? 0 : count;
  }

  private recordOffset(bankId: number, slot: number): number {
    return bankId * PAGE_SIZE + BANK_HEADER_SIZE + slot * CHANNEL_RECORD_SIZE;
  }

  /** Reads a single channel record. */
  readChannel(bankId: number, slot: number): Channel {
    if (slot < 0 || slot >= CHANNELS_PER_BANK) {
      throw new CodeplugFormatError(
        `Channel slot ${slot} is outside the ${CHANNELS_PER_BANK} slots in a bank.`,
      );
    }
    const at = this.recordOffset(bankId, slot);
    const nameBytes = this.image.subarray(at + CHANNEL.name, at + CHANNEL.name + CHANNEL.nameLength);
    const end = nameBytes.indexOf(0x00);
    const name = new TextDecoder('ascii').decode(
      end === -1 ? nameBytes : nameBytes.subarray(0, end),
    );

    return {
      bankId,
      slot,
      name,
      rxHz: decodeFrequency(
        this.image.subarray(
          at + CHANNEL.rxFrequency,
          at + CHANNEL.rxFrequency + CHANNEL.frequencyLength,
        ),
      ),
      txHz: decodeFrequency(
        this.image.subarray(
          at + CHANNEL.txFrequency,
          at + CHANNEL.txFrequency + CHANNEL.frequencyLength,
        ),
      ),
    };
  }

  /** Every channel in use, across all allocated banks. */
  channels(): readonly Channel[] {
    const out: Channel[] = [];
    for (const bankId of this.allocatedChannelBanks()) {
      const count = this.channelCount(bankId);
      for (let slot = 0; slot < count; slot++) {
        out.push(this.readChannel(bankId, slot));
      }
    }
    return out;
  }

  /**
   * Writes a channel's decoded fields back into the image.
   *
   * Only the name and frequency bytes are touched; every other byte of the
   * record, including fields this project has not yet decoded, is left exactly
   * as the radio wrote it.
   */
  writeChannel(channel: Channel): void {
    const base = channel.bankId * PAGE_SIZE;
    if (!this.isAllocated(base)) {
      throw new CodeplugFormatError(
        `Refusing to write to bank 0x${channel.bankId.toString(16)}: the page is not ` +
          'allocated on this radio, so those bytes are filler rather than codeplug data.',
      );
    }
    const at = this.recordOffset(channel.bankId, channel.slot);

    const encoded = new TextEncoder().encode(channel.name);
    if (encoded.length > CHANNEL.nameLength) {
      throw new CodeplugFormatError(
        `Channel name "${channel.name}" is ${encoded.length} bytes; the field holds ` +
          `${CHANNEL.nameLength}.`,
      );
    }
    if (encoded.some((byte) => byte > 0x7f)) {
      throw new CodeplugFormatError(`Channel name "${channel.name}" is not ASCII.`);
    }
    this.image.fill(0x00, at + CHANNEL.name, at + CHANNEL.name + CHANNEL.nameLength);
    this.image.set(encoded, at + CHANNEL.name);

    if (channel.rxHz !== null) {
      this.image.set(encodeFrequency(channel.rxHz), at + CHANNEL.rxFrequency);
    }
    if (channel.txHz !== null) {
      this.image.set(encodeFrequency(channel.txHz), at + CHANNEL.txFrequency);
    }
  }
}
