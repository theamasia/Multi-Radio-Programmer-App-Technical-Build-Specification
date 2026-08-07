/**
 * Types for regulatory frequency data and transmit-legality checking.
 *
 * This module is deliberately pure and dependency-free so it can run in the
 * renderer as well as the main process. Frequency validation therefore happens
 * as the user types, with no IPC round trip and no file or network I/O.
 *
 * DESIGN RULE: every regulatory figure in this system carries a source URL.
 * A power limit without a citation is a liability, not data.
 */

/** Radio services this app knows how to reason about. */
export type ServiceId = 'amateur' | 'gmrs' | 'frs' | 'murs' | 'noaa' | 'marine';

/**
 * US amateur license classes, ordered by privilege.
 *
 * `none` covers unlicensed use and services like FRS that require no licence.
 * Novice is omitted: no new Novice licences have been issued for decades, and
 * modelling it would add privilege edge cases with essentially no real users.
 */
export type LicenseClass = 'none' | 'technician' | 'general' | 'advanced' | 'extra';

/**
 * How a power limit is measured. These are not interchangeable, and conflating
 * them produces wrong answers: 1500 W PEP and 1500 W ERP are different limits.
 */
export type PowerBasis = 'PEP' | 'ERP' | 'EIRP' | 'TPO';

/** Emission types, coarse enough to map onto what consumer radios expose. */
export type EmissionMode = 'CW' | 'SSB' | 'AM' | 'FM' | 'NFM' | 'DATA' | 'DMR';

/**
 * Where a piece of frequency data came from, and whether we may redistribute it.
 *
 * This distinction is structural rather than advisory. US federal regulations
 * are public domain and ship with the app. Third-party repeater directories are
 * licensed for personal use, so they may be cached at runtime but must never be
 * committed to the repository or redistributed.
 */
export type Provenance =
  /** US federal regulation. Public domain, safe to redistribute. */
  | { readonly kind: 'regulation'; readonly sourceUrl: string; readonly citation: string }
  /** Voluntary band plan (e.g. ARRL). Advisory, not legally binding. */
  | { readonly kind: 'bandPlan'; readonly sourceUrl: string; readonly citation: string }
  /** Licensed third-party directory data. Cache only; never redistribute. */
  | { readonly kind: 'directory'; readonly sourceUrl: string; readonly attribution: string };

/**
 * A contiguous frequency range with a single set of operating privileges.
 *
 * A band is split into as many segments as it takes for every field here to be
 * uniform across the segment, so validation never has to special-case.
 */
export interface BandSegment {
  readonly serviceId: ServiceId;
  /** Human label, e.g. "20 m" or "70 cm". */
  readonly bandName: string;
  /** Inclusive lower bound in Hz. */
  readonly startHz: number;
  /** Inclusive upper bound in Hz. */
  readonly endHz: number;
  /** Licence classes permitted to transmit in this segment. */
  readonly licenseClasses: readonly LicenseClass[];
  /** Permitted emission modes. Empty means "not restricted by this dataset". */
  readonly modes: readonly EmissionMode[];
  /** Maximum permitted power, or null when this dataset does not constrain it. */
  readonly maxPowerW: number | null;
  readonly powerBasis: PowerBasis;
  /**
   * Per-class power limits that override `maxPowerW`.
   *
   * Needed because some limits depend on who is operating, not only on where.
   * The Novice/Technician HF sub-bands are capped at 200 W PEP by
   * 47 CFR 97.313(c)(2) while higher classes get the full 1500 W on the exact
   * same frequencies, so a single figure per segment cannot express the rule.
   */
  readonly powerByLicenseClass?: Partial<Record<LicenseClass, number>>;
  /** True when transmitting is never permitted here (e.g. NOAA weather). */
  readonly receiveOnly: boolean;
  readonly notes?: string;
  readonly provenance: Provenance;
}

/**
 * A channelized allocation with a fixed, regulator-assigned frequency.
 *
 * Services like GMRS and FRS are defined as numbered channels rather than
 * ranges, and users refer to them by number, so they are modelled directly
 * instead of being flattened into segments.
 */
export interface FixedChannel {
  readonly serviceId: ServiceId;
  readonly channelNumber: number;
  readonly label: string;
  readonly rxHz: number;
  /** Transmit frequency, or null when the channel is receive-only. */
  readonly txHz: number | null;
  readonly maxPowerW: number | null;
  readonly powerBasis: PowerBasis;
  /** Maximum authorized bandwidth in Hz, or null when unspecified. */
  readonly maxBandwidthHz: number | null;
  readonly modes: readonly EmissionMode[];
  /** True when the service requires an individual licence, as GMRS does. */
  readonly requiresLicense: boolean;
  /**
   * True when transmitting is never authorized on this channel.
   *
   * Held separately from `txHz: null` so that a channel stored with a transmit
   * frequency equal to its receive frequency -- which is how many radios encode
   * NOAA weather memories -- still fails closed.
   */
  readonly receiveOnly: boolean;
  readonly notes?: string;
  readonly provenance: Provenance;
}

/** Severity of a validation finding. */
export type FindingSeverity = 'error' | 'warning';

/** Why a proposed transmission was rejected or flagged. */
export type FindingCode =
  | 'unknownAllocation'
  | 'receiveOnly'
  | 'outOfBand'
  | 'exceedsPower'
  | 'licenseInsufficient'
  | 'modeNotPermitted'
  | 'exceedsBandwidth'
  | 'crossServiceSplit'
  | 'ambiguousService'
  | 'advisoryBandPlan';

export interface ValidationFinding {
  readonly code: FindingCode;
  readonly severity: FindingSeverity;
  /** Operator-facing explanation. Should name the actual limit and the value. */
  readonly message: string;
  /** Citation for the rule being applied, so the user can check our work. */
  readonly sourceUrl?: string;
}

/** A proposed transmission to check. */
export interface TransmitRequest {
  readonly txFrequencyHz: number;
  readonly rxFrequencyHz?: number;
  readonly powerW?: number;
  readonly mode?: EmissionMode;
  readonly bandwidthHz?: number;
  readonly licenseClass: LicenseClass;
  /**
   * Which service the radio is operating under.
   *
   * Required to disambiguate shared frequencies: 462.5625 MHz is GMRS channel 1
   * at 5 W ERP and FRS channel 1 at 2 W ERP simultaneously. Without it, the
   * validator applies the most restrictive limit of the matching services and
   * says so, rather than silently choosing the permissive one.
   */
  readonly serviceProfile?: ServiceId;
  /** Set when the channel is configured as receive-only, which is always legal. */
  readonly rxOnly?: boolean;
}

export interface ValidationResult {
  readonly findings: readonly ValidationFinding[];
  /** True when no finding has severity 'error'. */
  readonly permitted: boolean;
  /** The segment or channel matched, useful for display. */
  readonly matched:
    | { readonly kind: 'segment'; readonly segment: BandSegment }
    | { readonly kind: 'fixedChannel'; readonly channel: FixedChannel }
    | { readonly kind: 'none' };
}

/**
 * A complete regional ruleset.
 *
 * `version` is recorded alongside any validation result that gets persisted, so
 * a codeplug approved under an older ruleset can be re-checked when the rules
 * change rather than being trusted indefinitely.
 */
export interface FrequencyDataset {
  readonly region: 'US';
  readonly version: string;
  readonly segments: readonly BandSegment[];
  readonly fixedChannels: readonly FixedChannel[];
}
