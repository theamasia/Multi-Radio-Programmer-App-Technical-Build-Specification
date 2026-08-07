/**
 * Personal Radio Services, 47 CFR Part 95 Subparts E (GMRS), B (FRS), J (MURS).
 *
 * POWER BASIS WARNING. Part 95 mixes two incompatible bases and this application
 * must not conflate them:
 *   - GMRS channels 1-14 and all FRS channels are limited by ERP, which folds in
 *     antenna gain.
 *   - GMRS channels 15-22 and all of MURS are limited by transmitter output
 *     power, with no ERP limit at all.
 * A 50 W GMRS mobile on a 6 dBd antenna is legal because the 50 W figure is
 * output power; the same arithmetic applied to an ERP-limited channel would not
 * be. Every row below therefore carries an explicit `powerBasis`.
 *
 * Channels 1-7 and 15-22 share transmit frequencies between GMRS and FRS at
 * different power limits, so the validator disambiguates by service profile and
 * falls back to the stricter limit. See validate.ts.
 */

import type { EmissionMode, FixedChannel, Provenance } from '../types.js';

const MHZ = 1_000_000;

const GMRS_RULE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.law.cornell.edu/cfr/text/47/95.1763',
  citation: '47 CFR 95.1763 GMRS channels / 95.1767 GMRS transmitting power',
};

const FRS_RULE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.law.cornell.edu/cfr/text/47/95.563',
  citation: '47 CFR 95.563 FRS channels / 95.567 FRS transmitting power',
};

const MURS_RULE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.law.cornell.edu/cfr/text/47/95.2763',
  citation: '47 CFR 95.2763 MURS channels / 95.2767 MURS transmitting power',
};

const FM: readonly EmissionMode[] = ['FM', 'NFM'];

/** Interstitial channels 1-7, shared by GMRS and FRS at 462 MHz. */
const INTERSTITIAL_462 = [
  462.5625, 462.5875, 462.6125, 462.6375, 462.6625, 462.6875, 462.7125,
] as const;

/** Interstitial channels 8-14 at 467 MHz, handheld only, 0.5 W in both services. */
const INTERSTITIAL_467 = [
  467.5625, 467.5875, 467.6125, 467.6375, 467.6625, 467.6875, 467.7125,
] as const;

/** Primary channels 15-22, the GMRS repeater outputs and high-power simplex pairs. */
const PRIMARY_462 = [
  462.55, 462.575, 462.6, 462.625, 462.65, 462.675, 462.7, 462.725,
] as const;

/** Repeater inputs paired 5 MHz above the channel 15-22 outputs. */
const PRIMARY_467 = [
  467.55, 467.575, 467.6, 467.625, 467.65, 467.675, 467.7, 467.725,
] as const;

const GMRS_CHANNELS: readonly FixedChannel[] = [
  ...INTERSTITIAL_462.map((mhz, index) => ({
    serviceId: 'gmrs' as const,
    channelNumber: index + 1,
    label: `GMRS ${index + 1}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 5,
    powerBasis: 'ERP' as const,
    maxBandwidthHz: 12_500,
    modes: FM,
    requiresLicense: true,
    receiveOnly: false,
    notes: 'Shared with FRS channel ' + String(index + 1) + ', which is limited to 2 W ERP',
    provenance: GMRS_RULE,
  })),
  ...INTERSTITIAL_467.map((mhz, index) => ({
    serviceId: 'gmrs' as const,
    channelNumber: index + 8,
    label: `GMRS ${index + 8}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 0.5,
    powerBasis: 'ERP' as const,
    maxBandwidthHz: 12_500,
    modes: FM,
    requiresLicense: true,
    receiveOnly: false,
    notes: 'Hand-held portable units only; no mobile, repeater, base or fixed stations',
    provenance: GMRS_RULE,
  })),
  ...PRIMARY_462.map((mhz, index) => ({
    serviceId: 'gmrs' as const,
    channelNumber: index + 15,
    label: `GMRS ${index + 15}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 50,
    powerBasis: 'TPO' as const,
    maxBandwidthHz: 20_000,
    modes: FM,
    requiresLicense: true,
    receiveOnly: false,
    notes:
      '50 W is transmitter output power, not ERP. Fixed stations are capped at 15 W. ' +
      'Shared with FRS channel ' + String(index + 15) + ' at 2 W ERP',
    provenance: GMRS_RULE,
  })),
  ...PRIMARY_467.map((mhz, index) => ({
    serviceId: 'gmrs' as const,
    channelNumber: index + 15,
    label: `GMRS ${index + 15}R repeater input`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round((PRIMARY_462[index] as number) * MHZ),
    maxPowerW: 50,
    powerBasis: 'TPO' as const,
    maxBandwidthHz: 20_000,
    modes: FM,
    requiresLicense: true,
    receiveOnly: false,
    notes:
      'Repeater input, paired 5 MHz above the channel ' +
      String(index + 15) +
      ' output. Only repeaters and stations working through them transmit here',
    provenance: GMRS_RULE,
  })),
];

const FRS_CHANNELS: readonly FixedChannel[] = [
  ...INTERSTITIAL_462.map((mhz, index) => ({
    serviceId: 'frs' as const,
    channelNumber: index + 1,
    label: `FRS ${index + 1}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 2,
    powerBasis: 'ERP' as const,
    maxBandwidthHz: 12_500,
    modes: FM,
    requiresLicense: false,
    receiveOnly: false,
    notes: 'Raised from 0.5 W to 2 W ERP by the 2017 Personal Radio Services reform',
    provenance: FRS_RULE,
  })),
  ...INTERSTITIAL_467.map((mhz, index) => ({
    serviceId: 'frs' as const,
    channelNumber: index + 8,
    label: `FRS ${index + 8}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 0.5,
    powerBasis: 'ERP' as const,
    maxBandwidthHz: 12_500,
    modes: FM,
    requiresLicense: false,
    receiveOnly: false,
    provenance: FRS_RULE,
  })),
  ...PRIMARY_462.map((mhz, index) => ({
    serviceId: 'frs' as const,
    channelNumber: index + 15,
    label: `FRS ${index + 15}`,
    txHz: Math.round(mhz * MHZ),
    rxHz: Math.round(mhz * MHZ),
    maxPowerW: 2,
    powerBasis: 'ERP' as const,
    maxBandwidthHz: 12_500,
    modes: FM,
    requiresLicense: false,
    receiveOnly: false,
    notes:
      'FRS is limited to 12.5 kHz here even though GMRS may use 20 kHz on the ' +
      'same frequency',
    provenance: FRS_RULE,
  })),
];

/**
 * MURS. Licence-free, and the only Part 95 service in this file where the
 * limit is transmitter output power with no ERP cap, which is why external
 * antennas are permitted.
 */
const MURS_CHANNELS: readonly FixedChannel[] = (
  [
    { mhz: 151.82, bw: 11_250 },
    { mhz: 151.88, bw: 11_250 },
    { mhz: 151.94, bw: 11_250 },
    { mhz: 154.57, bw: 20_000 },
    { mhz: 154.6, bw: 20_000 },
  ] as const
).map((entry, index) => ({
  serviceId: 'murs' as const,
  channelNumber: index + 1,
  label: `MURS ${index + 1}`,
  txHz: Math.round(entry.mhz * MHZ),
  rxHz: Math.round(entry.mhz * MHZ),
  maxPowerW: 2,
  powerBasis: 'TPO' as const,
  maxBandwidthHz: entry.bw,
  modes: FM,
  requiresLicense: false,
  receiveOnly: false,
  notes:
    '2 W transmitter output power with no ERP limit, so gain antennas are allowed. ' +
    (entry.bw === 11_250
      ? 'Narrowband channel, 11.25 kHz maximum.'
      : 'Wideband channel, 20 kHz maximum.'),
  provenance: MURS_RULE,
}));

export const PART_95_CHANNELS: readonly FixedChannel[] = [
  ...GMRS_CHANNELS,
  ...FRS_CHANNELS,
  ...MURS_CHANNELS,
];
