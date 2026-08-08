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
  CONTACT,
  CONTACT_PAGE_ID,
  CONTACT_RECORD_SIZE,
  CONTACTS_PER_PAGE,
  ZONE,
  ZONE_BANK_FIRST_ID,
  ZONE_BANK_LAST_ID,
  ZONE_RECORD_SIZE,
  ZONES_PER_BANK,
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

/** A zone: a named group of channels. */
export interface Zone {
  readonly bankId: number;
  readonly slot: number;
  readonly name: string;
  /** Channel numbers, 1-based, in the order the radio steps through them. */
  readonly channels: readonly number[];
}

/** A digital contact. */
export interface Contact {
  readonly slot: number;
  readonly name: string;
  /** DMR ID. `0xffffff` is the All Call broadcast address. */
  readonly dmrId: number;
  /**
   * Raw call-type byte, deliberately not interpreted.
   *
   * The factory image uses three values and only the All Call one is
   * confirmed, so exposing a decoded enum would be inventing meaning.
   */
  readonly callTypeRaw: number;
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

  /** Reads a fixed-width, NUL-terminated ASCII field. */
  private readName(at: number, length: number): string {
    const bytes = this.image.subarray(at, at + length);
    const end = bytes.indexOf(0x00);
    return new TextDecoder('ascii').decode(end === -1 ? bytes : bytes.subarray(0, end));
  }

  /**
   * Writes a fixed-width, NUL-terminated ASCII field.
   *
   * Only the name and its terminator are written; bytes past the terminator
   * are left alone. The radio pads inconsistently -- channel names are padded
   * with `0x00` and contact names with `0xff` in the same factory image -- so
   * normalising the padding would rewrite bytes this project does not own and
   * break a byte-identical round-trip.
   */
  private writeName(at: number, length: number, name: string): void {
    const encoded = new TextEncoder().encode(name);
    if (encoded.some((byte) => byte > 0x7f)) {
      throw new CodeplugFormatError(`Name "${name}" is not ASCII.`);
    }
    if (encoded.length > length) {
      throw new CodeplugFormatError(
        `Name "${name}" is ${encoded.length} bytes; the field holds ${length}.`,
      );
    }
    this.image.set(encoded, at);
    if (encoded.length < length) this.image[at + encoded.length] = 0x00;
  }

  /** Reads a single channel record. */
  readChannel(bankId: number, slot: number): Channel {
    if (slot < 0 || slot >= CHANNELS_PER_BANK) {
      throw new CodeplugFormatError(
        `Channel slot ${slot} is outside the ${CHANNELS_PER_BANK} slots in a bank.`,
      );
    }
    const at = this.recordOffset(bankId, slot);
    const name = this.readName(at + CHANNEL.name, CHANNEL.nameLength);

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

    this.writeName(at + CHANNEL.name, CHANNEL.nameLength, channel.name);

    if (channel.rxHz !== null) {
      this.image.set(encodeFrequency(channel.rxHz), at + CHANNEL.rxFrequency);
    }
    if (channel.txHz !== null) {
      this.image.set(encodeFrequency(channel.txHz), at + CHANNEL.txFrequency);
    }
  }

  // ---------------------------------------------------------------- zones

  /** Logical block IDs of the allocated zone banks. */
  allocatedZoneBanks(): readonly number[] {
    const banks: number[] = [];
    for (let id = ZONE_BANK_FIRST_ID; id <= ZONE_BANK_LAST_ID; id++) {
      if (this.isAllocated(id * PAGE_SIZE)) banks.push(id);
    }
    return banks;
  }

  /** Number of zones in use in a bank, from its page header. */
  zoneCount(bankId: number): number {
    const base = bankId * PAGE_SIZE;
    if (!this.isAllocated(base)) return 0;
    const count = this.image[base + BANK_HEADER_COUNT_OFFSET] as number;
    return count > ZONES_PER_BANK ? 0 : count;
  }

  private zoneOffset(bankId: number, slot: number): number {
    return bankId * PAGE_SIZE + BANK_HEADER_SIZE + slot * ZONE_RECORD_SIZE;
  }

  /** Reads a single zone record. */
  readZone(bankId: number, slot: number): Zone {
    const at = this.zoneOffset(bankId, slot);
    const count = this.image[at + ZONE.channelCount] as number;
    if (count > ZONE.maxChannels) {
      throw new CodeplugFormatError(
        `Zone at bank 0x${bankId.toString(16)} slot ${slot} claims ${count} channels; ` +
          `a zone holds at most ${ZONE.maxChannels}.`,
      );
    }
    const channels: number[] = [];
    for (let i = 0; i < count; i++) {
      const off = at + ZONE.channels + i * 2;
      channels.push((this.image[off] as number) | ((this.image[off + 1] as number) << 8));
    }
    return { bankId, slot, name: this.readName(at + ZONE.name, ZONE.nameLength), channels };
  }

  /** Every zone in use. */
  zones(): readonly Zone[] {
    const out: Zone[] = [];
    for (const bankId of this.allocatedZoneBanks()) {
      const count = this.zoneCount(bankId);
      for (let slot = 0; slot < count; slot++) out.push(this.readZone(bankId, slot));
    }
    return out;
  }

  /** Writes a zone's decoded fields back into the image. */
  writeZone(zone: Zone): void {
    if (!this.isAllocated(zone.bankId * PAGE_SIZE)) {
      throw new CodeplugFormatError(
        `Refusing to write to zone bank 0x${zone.bankId.toString(16)}: the page is not allocated.`,
      );
    }
    if (zone.channels.length > ZONE.maxChannels) {
      throw new CodeplugFormatError(
        `A zone holds at most ${ZONE.maxChannels} channels, got ${zone.channels.length}.`,
      );
    }
    const at = this.zoneOffset(zone.bankId, zone.slot);
    this.writeName(at + ZONE.name, ZONE.nameLength, zone.name);
    this.image[at + ZONE.channelCount] = zone.channels.length;
    for (let i = 0; i < zone.channels.length; i++) {
      const channel = zone.channels[i] as number;
      if (!Number.isInteger(channel) || channel < 0 || channel > 0xffff) {
        throw new CodeplugFormatError(`Zone channel number ${channel} is out of range.`);
      }
      const off = at + ZONE.channels + i * 2;
      this.image[off] = channel & 0xff;
      this.image[off + 1] = (channel >> 8) & 0xff;
    }
  }

  // ------------------------------------------------------------- contacts

  private contactOffset(slot: number): number {
    return CONTACT_PAGE_ID * PAGE_SIZE + slot * CONTACT_RECORD_SIZE;
  }

  /** Reads a single contact record. */
  readContact(slot: number): Contact {
    const at = this.contactOffset(slot);
    const id = this.image.subarray(at + CONTACT.dmrId, at + CONTACT.dmrId + CONTACT.dmrIdLength);
    return {
      slot,
      name: this.readName(at + CONTACT.name, CONTACT.nameLength),
      dmrId:
        (id[0] as number) | ((id[1] as number) << 8) | ((id[2] as number) << 16),
      callTypeRaw: this.image[at + CONTACT.callType] as number,
    };
  }

  /**
   * Every contact.
   *
   * No count field has been located for contacts, so this stops at the first
   * record without a usable name. That is a heuristic, and it is recorded as
   * one rather than presented as the radio's own rule.
   */
  contacts(): readonly Contact[] {
    if (!this.isAllocated(CONTACT_PAGE_ID * PAGE_SIZE)) return [];
    const out: Contact[] = [];
    for (let slot = 0; slot < CONTACTS_PER_PAGE; slot++) {
      const contact = this.readContact(slot);
      if (contact.name.length === 0) break;
      out.push(contact);
    }
    return out;
  }

  /** Writes a contact's decoded fields back into the image. */
  writeContact(contact: Contact): void {
    if (!this.isAllocated(CONTACT_PAGE_ID * PAGE_SIZE)) {
      throw new CodeplugFormatError('Refusing to write contacts: the page is not allocated.');
    }
    if (!Number.isInteger(contact.dmrId) || contact.dmrId < 0 || contact.dmrId > 0xffffff) {
      throw new CodeplugFormatError(`DMR ID ${contact.dmrId} does not fit in 24 bits.`);
    }
    const at = this.contactOffset(contact.slot);
    this.writeName(at + CONTACT.name, CONTACT.nameLength, contact.name);
    this.image[at + CONTACT.dmrId] = contact.dmrId & 0xff;
    this.image[at + CONTACT.dmrId + 1] = (contact.dmrId >> 8) & 0xff;
    this.image[at + CONTACT.dmrId + 2] = (contact.dmrId >> 16) & 0xff;
    this.image[at + CONTACT.callType] = contact.callTypeRaw;
  }
}
