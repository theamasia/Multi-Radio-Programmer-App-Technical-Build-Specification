/**
 * Transmit-legality checking against regulatory allocations.
 *
 * FAIL-CLOSED BY DESIGN. A frequency that matches no known allocation is
 * reported as an error, not waved through. The alternative -- treating "we have
 * no data" as "probably fine" -- is how a programming tool talks someone into
 * transmitting outside their privileges. If the dataset is incomplete, the user
 * gets a clear "unknown allocation" they can override deliberately, rather than
 * silent approval they cannot see.
 *
 * This module is pure: no I/O, no clock, no globals. Every function takes its
 * dataset as an argument so tests can supply fixtures.
 */

import type {
  BandSegment,
  FixedChannel,
  LicenseClass,
  ServiceId,
  TransmitRequest,
  ValidationFinding,
  ValidationResult,
} from './types.js';

/** Privilege ordering. Higher value implies all lower privileges. */
const LICENSE_RANK: Record<LicenseClass, number> = {
  none: 0,
  technician: 1,
  general: 2,
  advanced: 3,
  extra: 4,
};

export interface Dataset {
  readonly segments: readonly BandSegment[];
  readonly fixedChannels: readonly FixedChannel[];
}

/** Formats Hz as MHz with enough precision for channel steps (e.g. 462.5625). */
export function formatMHz(hz: number): string {
  return `${(hz / 1e6).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} MHz`;
}

/** Finds the segment containing a frequency, or null. */
export function findSegment(
  segments: readonly BandSegment[],
  hz: number,
): BandSegment | null {
  return segments.find((segment) => hz >= segment.startHz && hz <= segment.endHz) ?? null;
}

/** Finds every fixed channel whose transmit or receive frequency matches exactly. */
export function findFixedChannels(
  channels: readonly FixedChannel[],
  hz: number,
  serviceProfile?: ServiceId,
): readonly FixedChannel[] {
  const matches = channels.filter(
    (channel) => channel.txHz === hz || channel.rxHz === hz,
  );
  if (serviceProfile === undefined) return matches;
  const scoped = matches.filter((channel) => channel.serviceId === serviceProfile);
  // Falling back to all matches keeps a wrong service profile from silently
  // hiding the fact that the frequency is allocated at all.
  return scoped.length > 0 ? scoped : matches;
}

/**
 * Picks the binding channel among shared allocations: the most restrictive.
 *
 * 462.5625 MHz is GMRS channel 1 (5 W) and FRS channel 1 (2 W) at once. With no
 * service profile to disambiguate, assuming 5 W would authorize a transmission
 * that is illegal for an FRS operator, so the lower limit wins.
 */
export function mostRestrictive(channels: readonly FixedChannel[]): FixedChannel | null {
  if (channels.length === 0) return null;
  return [...channels].sort((a, b) => {
    const ap = a.maxPowerW ?? Number.POSITIVE_INFINITY;
    const bp = b.maxPowerW ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    const ab = a.maxBandwidthHz ?? Number.POSITIVE_INFINITY;
    const bb = b.maxBandwidthHz ?? Number.POSITIVE_INFINITY;
    return ab - bb;
  })[0] as FixedChannel;
}

/**
 * Resolves the power limit for a segment, honouring class-specific overrides.
 *
 * Returns the lower of the general limit and any class override, so an override
 * can only tighten the limit, never loosen it.
 */
export function effectivePowerLimitW(
  segment: BandSegment,
  licenseClass: LicenseClass,
): number | null {
  const override = segment.powerByLicenseClass?.[licenseClass];
  if (override === undefined) return segment.maxPowerW;
  if (segment.maxPowerW === null) return override;
  return Math.min(override, segment.maxPowerW);
}

/** True when `held` confers at least the privileges of `required`. */
export function licenseCovers(held: LicenseClass, required: LicenseClass): boolean {
  return LICENSE_RANK[held] >= LICENSE_RANK[required];
}

/**
 * Checks a proposed transmission.
 *
 * Fixed-channel services are matched first: GMRS and FRS are defined as exact
 * channel frequencies, so an exact match is more specific -- and more useful to
 * report -- than the amateur segment that may overlap the same range.
 */
export function validateTransmit(
  dataset: Dataset,
  request: TransmitRequest,
): ValidationResult {
  const findings: ValidationFinding[] = [];

  // A receive-only channel cannot transmit, so nothing else needs checking.
  if (request.rxOnly === true) {
    return { findings: [], permitted: true, matched: { kind: 'none' } };
  }

  const matches = findFixedChannels(
    dataset.fixedChannels,
    request.txFrequencyHz,
    request.serviceProfile,
  );
  const fixed = mostRestrictive(matches);
  if (fixed !== null) {
    const services = [...new Set(matches.map((channel) => channel.serviceId))];
    if (services.length > 1 && request.serviceProfile === undefined) {
      findings.push({
        code: 'ambiguousService',
        severity: 'warning',
        message:
          `${formatMHz(request.txFrequencyHz)} is shared by ${services.join(' and ')}. ` +
          `Applying the most restrictive limit (${fixed.label}) because no service was ` +
          `specified. Set the radio's service to get the limit that applies to you.`,
      });
    }
    checkFixedChannel(fixed, request, findings);
    return finish(findings, { kind: 'fixedChannel', channel: fixed });
  }

  const segment = findSegment(dataset.segments, request.txFrequencyHz);
  if (segment === null) {
    findings.push({
      code: 'unknownAllocation',
      severity: 'error',
      message:
        `${formatMHz(request.txFrequencyHz)} does not fall in any allocation this app ` +
        `knows about. Transmitting is blocked because the app cannot confirm it is legal, ` +
        `not because it is necessarily illegal. Set the channel to receive-only, or verify ` +
        `the allocation yourself before overriding.`,
    });
    return finish(findings, { kind: 'none' });
  }

  checkSegment(segment, request, findings);

  // A repeater split that leaves the segment is a common and easily missed
  // mistake: the receive side looks fine while the transmit side is illegal.
  if (request.rxFrequencyHz !== undefined && request.rxFrequencyHz !== request.txFrequencyHz) {
    const rxSegment = findSegment(dataset.segments, request.rxFrequencyHz);
    if (rxSegment !== null && rxSegment.serviceId !== segment.serviceId) {
      findings.push({
        code: 'crossServiceSplit',
        severity: 'warning',
        message:
          `Receive is in the ${rxSegment.serviceId} service but transmit is in ` +
          `${segment.serviceId}. This is legal in some cross-band setups but is usually a ` +
          `mistake in an offset.`,
      });
    }
  }

  return finish(findings, { kind: 'segment', segment });
}

function checkFixedChannel(
  channel: FixedChannel,
  request: TransmitRequest,
  findings: ValidationFinding[],
): void {
  const url = provenanceUrl(channel);

  // The explicit flag is checked first and independently of the frequency
  // comparison. NOAA channels are stored with a transmit frequency equal to
  // their receive frequency on some radios, so relying on a mismatch alone
  // silently authorized transmitting on federal weather channels.
  if (channel.receiveOnly || channel.txHz === null || channel.txHz !== request.txFrequencyHz) {
    findings.push({
      code: 'receiveOnly',
      severity: 'error',
      message:
        `${formatMHz(request.txFrequencyHz)} is ${channel.label}, which is receive-only. ` +
        `Transmitting here is not authorized.`,
      ...(url !== undefined ? { sourceUrl: url } : {}),
    });
    return;
  }

  if (
    channel.maxPowerW !== null &&
    request.powerW !== undefined &&
    request.powerW > channel.maxPowerW
  ) {
    findings.push({
      code: 'exceedsPower',
      severity: 'error',
      message:
        `${request.powerW} W exceeds the ${channel.maxPowerW} W ` +
        `${channel.powerBasis} limit for ${channel.label}.`,
      ...(url !== undefined ? { sourceUrl: url } : {}),
    });
  }

  if (
    channel.maxBandwidthHz !== null &&
    request.bandwidthHz !== undefined &&
    request.bandwidthHz > channel.maxBandwidthHz
  ) {
    findings.push({
      code: 'exceedsBandwidth',
      severity: 'error',
      message:
        `${(request.bandwidthHz / 1000).toFixed(1)} kHz exceeds the authorized ` +
        `${(channel.maxBandwidthHz / 1000).toFixed(1)} kHz bandwidth for ${channel.label}.`,
      ...(url !== undefined ? { sourceUrl: url } : {}),
    });
  }
}

function checkSegment(
  segment: BandSegment,
  request: TransmitRequest,
  findings: ValidationFinding[],
): void {
  const url = provenanceUrl(segment);
  const cite = url !== undefined ? { sourceUrl: url } : {};

  if (segment.receiveOnly) {
    findings.push({
      code: 'receiveOnly',
      severity: 'error',
      message:
        `${segment.bandName} (${segment.serviceId}) is receive-only. Transmitting on ` +
        `${formatMHz(request.txFrequencyHz)} is not authorized.`,
      ...cite,
    });
    return;
  }

  const permitted = segment.licenseClasses.some((required) =>
    licenseCovers(request.licenseClass, required),
  );
  if (!permitted) {
    findings.push({
      code: 'licenseInsufficient',
      severity: 'error',
      message:
        `${formatMHz(request.txFrequencyHz)} in ${segment.bandName} requires ` +
        `${describeClasses(segment.licenseClasses)}. Your configured licence class is ` +
        `${request.licenseClass}.`,
      ...cite,
    });
  }

  const limitW = effectivePowerLimitW(segment, request.licenseClass);
  if (limitW !== null && request.powerW !== undefined && request.powerW > limitW) {
    findings.push({
      code: 'exceedsPower',
      severity: 'error',
      message:
        `${request.powerW} W exceeds the ${limitW} W ${segment.powerBasis} ` +
        `limit for ${segment.bandName}` +
        (segment.notes !== undefined ? ` (${segment.notes})` : '') +
        '.',
      ...cite,
    });
  }

  if (
    segment.modes.length > 0 &&
    request.mode !== undefined &&
    !segment.modes.includes(request.mode)
  ) {
    findings.push({
      code: 'modeNotPermitted',
      severity: 'error',
      message:
        `${request.mode} is not among the permitted emissions for ` +
        `${formatMHz(request.txFrequencyHz)} in ${segment.bandName} ` +
        `(permitted: ${segment.modes.join(', ')}).`,
      ...cite,
    });
  }

  // Voluntary band plans are not law. Flag rather than block, and say so.
  if (segment.provenance.kind === 'bandPlan') {
    findings.push({
      code: 'advisoryBandPlan',
      severity: 'warning',
      message:
        `${segment.bandName} usage here comes from a voluntary band plan, not FCC rules. ` +
        `It is advisory: operating outside it is legal but discouraged.`,
      ...cite,
    });
  }
}

function describeClasses(classes: readonly LicenseClass[]): string {
  const lowest = [...classes].sort((a, b) => LICENSE_RANK[a] - LICENSE_RANK[b])[0];
  return lowest === undefined ? 'an unknown licence class' : `at least ${lowest}`;
}

function provenanceUrl(item: BandSegment | FixedChannel): string | undefined {
  return item.provenance.sourceUrl;
}

function finish(
  findings: readonly ValidationFinding[],
  matched: ValidationResult['matched'],
): ValidationResult {
  return {
    findings,
    permitted: !findings.some((finding) => finding.severity === 'error'),
    matched,
  };
}
