/**
 * Codeplug structure layout for the DM-32UV / DP570UV family.
 *
 * Every constant here was derived by inspecting a codeplug read off real
 * hardware (`test/fixtures/dp570uv-factory-codeplug.bin`, firmware
 * `DM32.00.01.048`), not from a datasheet. Anything not confirmed against that
 * image is absent rather than guessed.
 *
 * Remember that these are offsets into the *virtual* address space. A virtual
 * page's physical location is discovered at runtime and is not stable between
 * radios, so nothing here may be used as a physical address.
 */

/** Virtual page index equals the page's logical block ID, confirmed for all 107 mapped pages. */
export const PAGE_ID_IS_PAGE_INDEX = true;

/**
 * Channel bank pages, as logical block IDs.
 *
 * `0x12` is channel bank slot 1. Banks run consecutively up to `0x41`; `0x42`
 * begins the TX contact index, which bounds the range from above.
 */
export const CHANNEL_BANK_FIRST_ID = 0x12;
export const CHANNEL_BANK_LAST_ID = 0x41;
export const CHANNEL_BANK_COUNT = CHANNEL_BANK_LAST_ID - CHANNEL_BANK_FIRST_ID + 1;

/**
 * Each bank page opens with a 16-byte header whose first byte is the number of
 * channels used in that page. On the factory image bank 1 reports 25, and
 * exactly 25 records carry names; records past the count are unused slots
 * holding `0xff` names and a 400 MHz placeholder frequency.
 */
export const BANK_HEADER_SIZE = 0x10;
export const BANK_HEADER_COUNT_OFFSET = 0x00;

/** Channel records are fixed 48-byte entries following the page header. */
export const CHANNEL_RECORD_SIZE = 0x30;

/** 4096-byte page, less the header, divided by the record size. */
export const CHANNELS_PER_BANK = 85;

/** Offsets within a single channel record. */
export const CHANNEL = {
  /** ASCII, NUL-padded. */
  name: 0x00,
  nameLength: 0x10,
  /** Receive frequency, 4-byte little-endian BCD in units of 10 Hz. */
  rxFrequency: 0x10,
  /** Transmit frequency, same encoding. */
  txFrequency: 0x14,
  frequencyLength: 4,
} as const;

/** Total channel slots addressable across every bank. */
export const TOTAL_CHANNEL_SLOTS = CHANNEL_BANK_COUNT * CHANNELS_PER_BANK;

/**
 * Zone bank pages, as logical block IDs. `0x5c` is zone bank slot 1.
 */
export const ZONE_BANK_FIRST_ID = 0x5c;
export const ZONE_BANK_LAST_ID = 0x64;

/** Zone records are 145 bytes, following the same 16-byte page header. */
export const ZONE_RECORD_SIZE = 0x91;
export const ZONES_PER_BANK = 28;

/** Offsets within a zone record. */
export const ZONE = {
  name: 0x00,
  nameLength: 0x10,
  /** Number of channels in the zone. */
  channelCount: 0x10,
  /** Channel numbers, 16-bit little-endian, 1-based. */
  channels: 0x11,
  maxChannels: 64,
} as const;

/**
 * Digital contacts. `0x44` holds the contact list.
 *
 * Records start at the page base with no header, and no count field has been
 * located, so the parser stops at the first record without a usable name.
 */
export const CONTACT_PAGE_ID = 0x44;
export const CONTACT_RECORD_SIZE = 0x18;
export const CONTACTS_PER_PAGE = 170;

/** Offsets within a contact record. */
export const CONTACT = {
  name: 0x02,
  nameLength: 0x10,
  /** DMR ID, 24-bit little-endian. `0xffffff` is the All Call broadcast ID. */
  dmrId: 0x13,
  dmrIdLength: 3,
  /**
   * Call type. `⚠️ DERIVED` -- the factory image uses `0x03`, `0x04` and
   * `0x05`, and only `0x05` is confirmed, because it is the record carrying
   * the All Call ID. The other two are not yet distinguished and are exposed
   * as a raw byte rather than guessed at.
   */
  callType: 0x16,
} as const;

/** The DMR broadcast address. */
export const ALL_CALL_ID = 0xffffff;
