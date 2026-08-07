/**
 * US amateur service allocations, 47 CFR Part 97.
 *
 * SOURCING NOTE. The 60 m band data below was verified by this project directly
 * against the amending Federal Register document, because it changed effective
 * 13 February 2026 and several widely used mirrors still serve the old rule.
 * Do not "correct" it against a mirror without checking that mirror's sync date.
 * See docs/protocol-notes/us-band-plan-research.md for the full audit.
 *
 * VHF/UHF and Part 95 figures matter most for this application, since it
 * programs handhelds. HF sub-band boundaries come from ARRL's verbatim Part 97
 * text mirror; they are long-standing and stable, but are second-hand relative
 * to eCFR, which is IP-blocked from this environment.
 *
 * Segments are split so that every field is uniform across the segment. That
 * keeps the validator free of special cases and makes each row auditable
 * against a single citation.
 */

import type { BandSegment, EmissionMode, LicenseClass, Provenance } from '../types.js';

const MHZ = 1_000_000;
const KHZ = 1_000;

/** 47 CFR 97.313(b): the default ceiling unless a specific rule overrides it. */
const DEFAULT_PEP_W = 1500;

/** 47 CFR 97.313(c)(2) caps the Novice-heritage HF sub-bands for Technicians. */
const NOVICE_HERITAGE_CAP: Partial<Record<LicenseClass, number>> = { technician: 200 };

const PART_97: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.arrl.org/part-97-text',
  citation: '47 CFR 97.301 / 97.305 (ARRL verbatim Part 97 mirror)',
};

const POWER_97_313: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.law.cornell.edu/cfr/text/47/97.313',
  citation: '47 CFR 97.313 transmitter power standards',
};

/** The 2026 60 m final rule, verified from the Federal Register text itself. */
const SIXTY_METER_RULE: Provenance = {
  kind: 'regulation',
  sourceUrl: 'https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf',
  citation:
    '91 FR, ET Docket 23-120, FCC 25-60, effective 2026-02-13; ' +
    'amends 47 CFR 97.301/97.303(h)/97.305/97.307(f)(14)/97.313(i)',
};

const GENERAL_UP: readonly LicenseClass[] = ['general', 'advanced', 'extra'];
const TECH_UP: readonly LicenseClass[] = ['technician', 'general', 'advanced', 'extra'];

const DATA_MODES: readonly EmissionMode[] = ['CW', 'DATA'];
const VOICE_DATA: readonly EmissionMode[] = ['CW', 'SSB', 'AM', 'FM', 'NFM', 'DATA', 'DMR'];

function segment(input: {
  bandName: string;
  startHz: number;
  endHz: number;
  licenseClasses: readonly LicenseClass[];
  modes?: readonly EmissionMode[];
  maxPowerW?: number | null;
  powerBasis?: BandSegment['powerBasis'];
  powerByLicenseClass?: Partial<Record<LicenseClass, number>>;
  notes?: string;
  provenance?: Provenance;
}): BandSegment {
  return {
    serviceId: 'amateur',
    bandName: input.bandName,
    startHz: input.startHz,
    endHz: input.endHz,
    licenseClasses: input.licenseClasses,
    modes: input.modes ?? [],
    maxPowerW: input.maxPowerW === undefined ? DEFAULT_PEP_W : input.maxPowerW,
    powerBasis: input.powerBasis ?? 'PEP',
    receiveOnly: false,
    ...(input.powerByLicenseClass !== undefined
      ? { powerByLicenseClass: input.powerByLicenseClass }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    provenance: input.provenance ?? PART_97,
  };
}

/**
 * LF/MF bands. Both are EIRP-limited rather than PEP-limited, which is why
 * `powerBasis` exists at all: 1 W EIRP and 1500 W PEP are not comparable.
 */
const LF_MF: readonly BandSegment[] = [
  segment({
    bandName: '2200 m',
    startHz: 135.7 * KHZ,
    endHz: 137.8 * KHZ,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
    maxPowerW: 1,
    powerBasis: 'EIRP',
    notes: '47 CFR 97.313(k); fixed stations only, 1 km from PLC lines, UTC notification',
    provenance: POWER_97_313,
  }),
  segment({
    bandName: '630 m',
    startHz: 472 * KHZ,
    endHz: 479 * KHZ,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
    maxPowerW: 5,
    powerBasis: 'EIRP',
    notes:
      '47 CFR 97.313(l); 1 W EIRP in Alaska within 800 km of Russia; ' +
      'fixed stations only, UTC notification',
    provenance: POWER_97_313,
  }),
];

const HF: readonly BandSegment[] = [
  // 160 m
  segment({ bandName: '160 m', startHz: 1.8 * MHZ, endHz: 2.0 * MHZ, licenseClasses: GENERAL_UP }),

  // 80/75 m. Split at each class boundary so power and privilege stay uniform.
  segment({
    bandName: '80 m',
    startHz: 3.5 * MHZ,
    endHz: 3.525 * MHZ - 1,
    licenseClasses: ['extra'],
    modes: DATA_MODES,
  }),
  segment({
    bandName: '80 m',
    startHz: 3.525 * MHZ,
    endHz: 3.6 * MHZ,
    licenseClasses: TECH_UP,
    modes: DATA_MODES,
    powerByLicenseClass: NOVICE_HERITAGE_CAP,
    notes: 'Technician access is CW only and capped at 200 W PEP by 97.313(c)(2)',
  }),
  segment({
    bandName: '75 m',
    startHz: 3.6 * MHZ,
    endHz: 3.7 * MHZ - 1,
    licenseClasses: ['extra'],
  }),
  segment({
    bandName: '75 m',
    startHz: 3.7 * MHZ,
    endHz: 3.8 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({ bandName: '75 m', startHz: 3.8 * MHZ, endHz: 4.0 * MHZ, licenseClasses: GENERAL_UP }),

  // 60 m. Verified directly against the 2026 final rule; see SIXTY_METER_RULE.
  // Each retained discrete channel is a 2.8 kHz window centred on the assigned
  // frequency, so the window is modelled rather than a single point.
  ...([5332.0, 5348.0, 5373.0, 5405.0] as const).map((centreKHz) =>
    segment({
      bandName: `60 m channel ${centreKHz} kHz`,
      startHz: Math.round(centreKHz * KHZ - 1.4 * KHZ),
      endHz: Math.round(centreKHz * KHZ + 1.4 * KHZ),
      licenseClasses: GENERAL_UP,
      modes: ['CW', 'SSB', 'DATA'],
      maxPowerW: 100,
      powerBasis: 'ERP',
      notes:
        '97.313(i); one of four retained discrete channels. Emissions must not exceed ' +
        '2.8 kHz. Phone/data/RTTY carrier may sit 1.5 kHz below centre',
      provenance: SIXTY_METER_RULE,
    }),
  ),
  segment({
    bandName: '60 m band (5351.5-5366.5 kHz)',
    startHz: 5351.5 * KHZ,
    endHz: 5366.5 * KHZ,
    licenseClasses: GENERAL_UP,
    modes: ['CW', 'SSB', 'DATA'],
    maxPowerW: 9.15,
    powerBasis: 'ERP',
    notes:
      '97.313(i): 9.15 W ERP, equivalent to 15 W EIRP. Secondary allocation, no ' +
      'channelization required. The former 5358.5 kHz channel now falls in here and ' +
      'is no longer permitted at 100 W',
    provenance: SIXTY_METER_RULE,
  }),

  // 40 m
  segment({
    bandName: '40 m',
    startHz: 7.0 * MHZ,
    endHz: 7.025 * MHZ - 1,
    licenseClasses: ['extra'],
    modes: DATA_MODES,
  }),
  segment({
    bandName: '40 m',
    startHz: 7.025 * MHZ,
    endHz: 7.125 * MHZ,
    licenseClasses: TECH_UP,
    modes: DATA_MODES,
    powerByLicenseClass: NOVICE_HERITAGE_CAP,
    notes: 'Technician access is CW only and capped at 200 W PEP by 97.313(c)(2)',
  }),
  segment({
    bandName: '40 m',
    startHz: 7.125 * MHZ,
    endHz: 7.175 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({ bandName: '40 m', startHz: 7.175 * MHZ, endHz: 7.3 * MHZ, licenseClasses: GENERAL_UP }),

  // 30 m. Rare case where even Amateur Extra is power limited.
  segment({
    bandName: '30 m',
    startHz: 10.1 * MHZ,
    endHz: 10.15 * MHZ,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
    maxPowerW: 200,
    notes: '97.313(c)(1): 200 W PEP for every licence class, including Extra. No phone',
    provenance: POWER_97_313,
  }),

  // 20 m
  segment({
    bandName: '20 m',
    startHz: 14.0 * MHZ,
    endHz: 14.025 * MHZ - 1,
    licenseClasses: ['extra'],
    modes: DATA_MODES,
  }),
  segment({
    bandName: '20 m',
    startHz: 14.025 * MHZ,
    endHz: 14.15 * MHZ,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
  }),
  segment({
    bandName: '20 m',
    startHz: 14.15 * MHZ,
    endHz: 14.175 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({
    bandName: '20 m',
    startHz: 14.175 * MHZ,
    endHz: 14.225 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({
    bandName: '20 m',
    startHz: 14.225 * MHZ,
    endHz: 14.35 * MHZ,
    licenseClasses: GENERAL_UP,
  }),

  // 17 m
  segment({
    bandName: '17 m',
    startHz: 18.068 * MHZ,
    endHz: 18.11 * MHZ - 1,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
  }),
  segment({
    bandName: '17 m',
    startHz: 18.11 * MHZ,
    endHz: 18.168 * MHZ,
    licenseClasses: GENERAL_UP,
  }),

  // 15 m
  segment({
    bandName: '15 m',
    startHz: 21.0 * MHZ,
    endHz: 21.025 * MHZ - 1,
    licenseClasses: ['extra'],
    modes: DATA_MODES,
  }),
  segment({
    bandName: '15 m',
    startHz: 21.025 * MHZ,
    endHz: 21.2 * MHZ,
    licenseClasses: TECH_UP,
    modes: DATA_MODES,
    powerByLicenseClass: NOVICE_HERITAGE_CAP,
    notes: 'Technician access is CW only and capped at 200 W PEP by 97.313(c)(2)',
  }),
  segment({
    bandName: '15 m',
    startHz: 21.2 * MHZ,
    endHz: 21.225 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({
    bandName: '15 m',
    startHz: 21.225 * MHZ,
    endHz: 21.275 * MHZ - 1,
    licenseClasses: ['advanced', 'extra'],
  }),
  segment({
    bandName: '15 m',
    startHz: 21.275 * MHZ,
    endHz: 21.45 * MHZ,
    licenseClasses: GENERAL_UP,
  }),

  // 12 m
  segment({
    bandName: '12 m',
    startHz: 24.89 * MHZ,
    endHz: 24.93 * MHZ - 1,
    licenseClasses: GENERAL_UP,
    modes: DATA_MODES,
  }),
  segment({
    bandName: '12 m',
    startHz: 24.93 * MHZ,
    endHz: 24.99 * MHZ,
    licenseClasses: GENERAL_UP,
  }),

  // 10 m. Technicians get real phone privileges here, unlike the other HF bands.
  segment({
    bandName: '10 m',
    startHz: 28.0 * MHZ,
    endHz: 28.3 * MHZ - 1,
    licenseClasses: TECH_UP,
    modes: DATA_MODES,
    powerByLicenseClass: NOVICE_HERITAGE_CAP,
  }),
  segment({
    bandName: '10 m',
    startHz: 28.3 * MHZ,
    endHz: 28.5 * MHZ,
    licenseClasses: TECH_UP,
    powerByLicenseClass: NOVICE_HERITAGE_CAP,
    notes: 'Technician phone privileges; 200 W PEP cap for Technician per 97.313(c)(2)',
  }),
  segment({
    bandName: '10 m',
    startHz: 28.5 * MHZ + 1,
    endHz: 29.7 * MHZ,
    licenseClasses: GENERAL_UP,
  }),
];

/**
 * VHF and UHF. These are the bands that actually matter for this application,
 * because they are what the radios it programs can transmit on.
 */
const VHF_UHF: readonly BandSegment[] = [
  segment({
    bandName: '6 m',
    startHz: 50.0 * MHZ,
    endHz: 50.1 * MHZ - 1,
    licenseClasses: TECH_UP,
    modes: ['CW'],
    notes: 'CW only below 50.1 MHz',
  }),
  segment({
    bandName: '6 m',
    startHz: 50.1 * MHZ,
    endHz: 54.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
  }),
  segment({
    bandName: '2 m',
    startHz: 144.0 * MHZ,
    endHz: 144.1 * MHZ - 1,
    licenseClasses: TECH_UP,
    modes: ['CW'],
    notes: 'CW only below 144.1 MHz',
  }),
  segment({
    bandName: '2 m',
    startHz: 144.1 * MHZ,
    endHz: 148.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
  }),
  segment({
    bandName: '1.25 m (219-220 MHz)',
    startHz: 219.0 * MHZ,
    endHz: 220.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: ['DATA'],
    maxPowerW: 50,
    notes:
      '97.313(h): 50 W PEP for all classes. Data only, fixed point-to-point ' +
      'message forwarding, 30-day advance notice to ARRL required',
    provenance: POWER_97_313,
  }),
  segment({
    bandName: '1.25 m',
    startHz: 222.0 * MHZ,
    endHz: 225.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
  }),
  segment({
    bandName: '70 cm',
    startHz: 420.0 * MHZ,
    endHz: 450.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
    notes:
      '97.313(f): reduced to 50 W PEP inside the coordination areas of ' +
      '2.106(c)(270)(i). No transmission north of Line A in 420-430 MHz',
  }),
  segment({
    bandName: '33 cm',
    startHz: 902.0 * MHZ,
    endHz: 928.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
    notes: '97.313(g): reduced to 50 W PEP within 241 km of White Sands Missile Range',
  }),
  segment({
    bandName: '23 cm',
    startHz: 1240.0 * MHZ,
    endHz: 1300.0 * MHZ,
    licenseClasses: TECH_UP,
    modes: VOICE_DATA,
  }),
];

export const AMATEUR_SEGMENTS: readonly BandSegment[] = [...LF_MF, ...HF, ...VHF_UHF];
