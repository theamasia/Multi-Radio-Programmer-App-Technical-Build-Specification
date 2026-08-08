/**
 * Baofeng DM-32UV protocol constants.
 *
 * Ported from qdmr's `lib/dm32uv_interface.{cc,hh}` (GPL-3.0,
 * https://github.com/hmatuschek/qdmr), cross-checked against
 * https://github.com/infamy/DM32-Protocol-Spec.
 */

/**
 * One known DM-32UV cable identity, kept for reference only.
 *
 * Do not use this for detection. Cables ship with whichever USB-serial bridge
 * chip is cheapest -- the reference cable for this project is a WCH CH340
 * (1a86:7523), not a Prolific. `scripts/dump-dm32uv.ts` holds the full table of
 * recognised chips.
 */
export const DM32UV_USB_PROLIFIC = { vendorId: '067b', productId: '23a3' } as const;

export const DM32UV_SERIAL = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
} as const;

/** qdmr uses a flat 1000ms timeout for every request/response exchange. */
export const TIMEOUT_MS = 1000;

/**
 * Inter-command delays. The radio's firmware needs settling time between
 * commands; without these the handshake fails intermittently.
 */
export const DELAY = {
  /** Before the first PSEARCH after opening the port. */
  beforeDetect: 500,
  /** Between successive setup commands. */
  betweenCommands: 100,
  /** Between address-map probe reads. */
  betweenMapProbes: 100,
  /** DTR held low on close so the adapter resets the radio. */
  resetOnClose: 500,
} as const;

/** ASCII command payloads, sent verbatim with no framing. */
export const COMMAND = {
  detect: 'PSEARCH',
  password: 'PASSSTA',
  sysinfo: 'SYSINFO',
} as const;

/**
 * Enter-program-mode payload: four 0xFF bytes, a 0x0C length byte, then
 * "PROGRAM".
 */
export const ENTER_PROGRAM_MODE = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x0c,
  0x50, 0x52, 0x4f, 0x47, 0x52, 0x41, 0x4d,
]);

/** Single-byte opcodes. */
export const OPCODE = {
  /** Undocumented command issued after entering program mode. */
  unknown02: 0x02,
  /** Keepalive. Shares its value with ACK, which is coincidental. */
  ping: 0x06,
} as const;

/** Response type bytes. */
export const RESPONSE = {
  ack: 0x06,
  password: 0x50,
  value: 0x56, // 'V'
  /** Read responses are tagged 'W', not 'R'. */
  readData: 0x57, // 'W'
} as const;

/** Request type bytes. */
export const REQUEST = {
  value: 0x56, // 'V'
  read: 0x52, // 'R'
  write: 0x57, // 'W'
} as const;

/**
 * Identifiers for the V-frame metadata queries used to discover memory layout
 * at connect time. Hardcoding addresses instead would break across firmware
 * variants, which relocate these regions.
 */
export const VALUE_ID = {
  firmwareVersion: 0x01,
  buildDate: 0x03,
  mainConfigMemory: 0x0a,
  callsignDbMemory: 0x0f,
} as const;

/** Model string the radio reports to PSEARCH. Not "DM-32UV". */
export const EXPECTED_MODEL_ID = 'DP570UV';

/** Transfers are aligned to and capped at 4 KiB pages. */
export const PAGE_SIZE = 0x1000;

/**
 * Byte written into virtual pages that the radio has not allocated.
 *
 * The assembled image is a flat array, so unallocated pages need some filler.
 * `0xff` matches the erased-flash convention and the marker the radio itself
 * uses for an empty page, but it is filler and not data read from the radio.
 * Never write these regions back: consult `AddressMap.unmappedVirtualPages()`.
 */
export const UNMAPPED_FILL = 0xff;

/**
 * Page-marker values that mean "this page is not allocated".
 *
 * Each 4 KiB page records its virtual page index in its own final byte. qdmr
 * treats both 0x00 and 0xff as "unallocated" sentinels.
 *
 * NOTE: this makes virtual page index 0 unrepresentable -- a page legitimately
 * holding virtual page 0 would be indistinguishable from an empty one. So the
 * codeplug's virtual address space effectively begins at 0x1000, and byte range
 * 0x0000-0x0fff of any assembled image is always unmapped. Verified against
 * qdmr's `getAddressMap`, which skips both values unconditionally.
 */
export const UNALLOCATED_PAGE_MARKERS: readonly number[] = [0x00, 0xff];

/** Detection retries. The USB-serial adapter is not always ready immediately. */
export const DETECT_ATTEMPTS = 3;

/** Firmware versions whose memory layout is known to match this port. */
export const KNOWN_FIRMWARE_PREFIXES = ['DM32.01'] as const;
