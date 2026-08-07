import type { Channel, Zone } from './Channel.js';
import type { DmrContact } from './Codeplug.js';

/**
 * A user-saved, portable configuration. Unlike a Codeplug, a profile contains
 * no raw image -- it is model-agnostic intent that can be applied to any radio
 * whose features are compatible.
 */
export interface RadioProfile {
  readonly profileVersion: 1;
  readonly name: string;
  /** Model this profile was authored against, for compatibility warnings. */
  readonly sourceModelId: string;
  readonly channels: readonly Channel[];
  readonly zones: readonly Zone[];
  readonly contacts: readonly DmrContact[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
