/**
 * Normalized channel representation shared across all radio models.
 *
 * Fields that only apply to some radios are optional. A driver must ignore
 * fields its hardware does not support, and must never silently coerce an
 * unsupported value into a supported one -- that is how users end up
 * transmitting on the wrong frequency.
 */

export type ChannelMode = 'FM' | 'NFM' | 'AM' | 'DMR';

export type PowerLevel = 'low' | 'medium' | 'high';

/** CTCSS tone in Hz (e.g. 146.2) or DCS code (e.g. "D023N"). */
export type ToneSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'ctcss'; readonly hz: number }
  | { readonly kind: 'dcs'; readonly code: string };

/** DMR-specific settings. Present only when mode is 'DMR'. */
export interface DmrSettings {
  readonly colorCode: number;
  readonly timeslot: 1 | 2;
  readonly contactId: number | null;
  readonly rxGroupId: number | null;
}

export interface Channel {
  /** Zero-based index within the radio's channel memory. */
  readonly index: number;
  readonly name: string;
  /** Receive frequency in Hz. Integer Hz avoids float rounding errors. */
  readonly rxFrequencyHz: number;
  /** Transmit frequency in Hz. Equals rxFrequencyHz for simplex. */
  readonly txFrequencyHz: number;
  readonly mode: ChannelMode;
  readonly power: PowerLevel;
  readonly rxTone: ToneSpec;
  readonly txTone: ToneSpec;
  /** True when the channel is receive-only (e.g. unlicensed or out-of-band). */
  readonly rxOnly: boolean;
  readonly dmr?: DmrSettings;
}

export interface Zone {
  readonly index: number;
  readonly name: string;
  /** Channel indices belonging to this zone, in display order. */
  readonly channelIndices: readonly number[];
}
