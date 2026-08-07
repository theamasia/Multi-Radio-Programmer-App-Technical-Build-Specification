import type { Channel, Zone } from './Channel.js';

/**
 * A complete, parsed radio configuration.
 *
 * `rawImage` preserves the exact bytes read from the radio. Drivers write back
 * by patching the raw image rather than regenerating it from scratch, so
 * unmapped regions (settings we have not reverse engineered) survive a
 * read-modify-write cycle untouched. This is the single most important
 * safeguard against bricking a radio.
 */
export interface Codeplug {
  readonly modelId: string;
  /** Schema version of this app's parsed representation, not the radio's. */
  readonly schemaVersion: number;
  readonly channels: readonly Channel[];
  readonly zones: readonly Zone[];
  readonly contacts: readonly DmrContact[];
  /** Verbatim bytes as read from the radio. Never mutate in place. */
  readonly rawImage: Uint8Array;
  readonly readAt: string;
}

export interface DmrContact {
  readonly index: number;
  readonly name: string;
  readonly dmrId: number;
  readonly type: 'private' | 'group' | 'allCall';
}
