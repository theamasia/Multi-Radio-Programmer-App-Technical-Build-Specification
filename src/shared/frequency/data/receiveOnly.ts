/**
 * Allocations this application must never let a user transmit on.
 *
 * Two distinct reasons are represented here, and conflating them produces bad
 * advice:
 *
 *  1. NOAA Weather Radio. Federal government stations. There is no licence,
 *     class, or power level at which an amateur or GMRS operator may transmit
 *     here. Radios that include these frequencies do so as receive-only memories.
 *
 *  2. Marine VHF. The frequencies exist as a licensed service, but the barrier
 *     for our users is equipment certification, not allocation: a Part 97 or
 *     Part 95 radio is not type-accepted for Part 80, so transmitting on marine
 *     channels with it is unlawful even for someone holding a marine licence.
 *     Channel 16 at 156.800 MHz is the distress frequency, which makes an
 *     accidental transmission here far more consequential than a mispunched
 *     amateur frequency. The whole 156-162 MHz range is therefore blocked rather
 *     than enumerated channel by channel.
 */

import type { BandSegment, FixedChannel, Provenance } from '../types.js';

const MHZ = 1_000_000;

const NOAA_SOURCE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.weather.gov/nwr/station_listing',
  citation: 'NOAA NWS Weather Radio All Hazards frequency list',
};

const MARINE_SOURCE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.navcen.uscg.gov/marine-vhf-radio-channels',
  citation: '47 CFR Part 80 / USCG Navigation Center marine VHF channel assignments',
};

/**
 * The seven NOAA weather channels, keyed by frequency.
 *
 * Deliberately not keyed by "WX1".."WX7": that numbering is a manufacturer
 * convention and differs between radios, so a codeplug built from channel
 * numbers can land on the wrong frequency.
 */
export const NOAA_CHANNELS: readonly FixedChannel[] = (
  [162.4, 162.425, 162.45, 162.475, 162.5, 162.525, 162.55] as const
).map((mhz, index) => ({
  serviceId: 'noaa' as const,
  channelNumber: index + 1,
  label: `NOAA Weather ${mhz.toFixed(3)} MHz`,
  // Null transmit frequency states "there is no lawful transmit frequency"
  // structurally, rather than leaving it to a power limit of zero.
  txHz: null,
  rxHz: Math.round(mhz * MHZ),
  maxPowerW: 0,
  powerBasis: 'TPO' as const,
  maxBandwidthHz: 25_000,
  modes: ['FM' as const],
  requiresLicense: false,
  receiveOnly: true,
  notes:
    'Federal government station. Receive only. The "WX" numbering used on radio ' +
    'front panels is a vendor convention, so this entry is keyed on frequency.',
  provenance: NOAA_SOURCE,
}));

export const RECEIVE_ONLY_SEGMENTS: readonly BandSegment[] = [
  {
    serviceId: 'marine',
    bandName: 'Marine VHF',
    startHz: 156 * MHZ,
    endHz: 162 * MHZ,
    licenseClasses: [],
    modes: ['FM'],
    maxPowerW: 0,
    powerBasis: 'TPO',
    receiveOnly: true,
    notes:
      'Blocked for transmit. Part 97/95 radios are not type-accepted under Part 80, ' +
      'so transmitting here is unlawful regardless of licence held. Includes channel ' +
      '16 at 156.800 MHz, the international distress and calling frequency.',
    provenance: MARINE_SOURCE,
  },
];
