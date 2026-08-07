/**
 * Assembles the offline frequency dataset.
 *
 * Everything here is public-domain regulatory data (17 U.S.C. 105), so it is
 * safe to embed and redistribute with the application. Licensed compilations
 * such as RepeaterBook or the ARRL Repeater Directory must never be added to
 * this module; they are cached at runtime under `Provenance.kind: 'directory'`
 * and never committed. That boundary is the reason `Provenance` is a required
 * field rather than a comment.
 */

import type { FrequencyDataset } from '../types.js';
import { AMATEUR_SEGMENTS } from './amateur.js';
import { PART_95_CHANNELS } from './part95.js';
import { NOAA_CHANNELS, RECEIVE_ONLY_SEGMENTS } from './receiveOnly.js';

/**
 * Ordered so that the most specific match wins.
 *
 * Receive-only segments are placed first because a blocked range must take
 * precedence over any transmit allocation that happens to overlap it.
 */
export const US_DATASET: FrequencyDataset = {
  region: 'US',
  /**
   * Bump when the encoded rules change, so a stored codeplug can record which
   * ruleset validated it. The 2026-02-13 date is the effective date of the
   * 60 m final rule, which is the newest rule encoded here.
   */
  version: '2026.02.13',
  segments: [...RECEIVE_ONLY_SEGMENTS, ...AMATEUR_SEGMENTS],
  fixedChannels: [...PART_95_CHANNELS, ...NOAA_CHANNELS],
};

export { AMATEUR_SEGMENTS } from './amateur.js';
export { PART_95_CHANNELS } from './part95.js';
export { NOAA_CHANNELS, RECEIVE_ONLY_SEGMENTS } from './receiveOnly.js';
