/**
 * Bridges a normalized `Channel` to the regulatory validator.
 *
 * Two independent questions must both be answered before a channel is written,
 * and they are deliberately kept apart:
 *
 *   1. CAN the radio do this? Hardware transmit range, supported modes, name
 *      length. Getting this wrong produces a corrupt codeplug.
 *   2. MAY the operator do this? Band edges, licence class, power, bandwidth.
 *      Getting this wrong produces an illegal transmission.
 *
 * Mixing them would let a hardware limit read as legal permission. A frequency
 * the radio physically cannot reach is not thereby legal, and a frequency
 * within the radio's range is not thereby permitted.
 */

import { US_DATASET } from './data/index.js';
import type { Channel, ChannelMode, PowerLevel } from '../types/Channel.js';
import type { EmissionMode, LicenseClass, ServiceId, ValidationResult } from './types.js';
import { validateTransmit } from './validate.js';

/** A contiguous transmit range the hardware can physically reach. */
export interface TxRange {
  readonly startHz: number;
  readonly endHz: number;
}

export interface RadioCapabilities {
  readonly model: string;
  readonly txRanges: readonly TxRange[];
  /**
   * Watts produced at each front-panel power setting.
   *
   * Needed because the radio speaks in low/medium/high while the regulations
   * speak in watts, and the mapping is model-specific.
   */
  readonly powerLevelW: Readonly<Record<PowerLevel, number>>;
  readonly maxChannelNameLength: number;
  readonly supportedModes: readonly ChannelMode[];
  /**
   * Set when `powerLevelW` has not yet been confirmed against the hardware.
   *
   * Any power finding derived from provisional figures is downgraded to a
   * warning and labelled, so an unverified number can never be the sole basis
   * for telling a user that a transmission is legal.
   */
  readonly powerFiguresProvisional?: boolean;
}

/**
 * Baofeng DM-32UV.
 *
 * Ranges and power figures come from published specifications, NOT from the
 * radio, and are marked provisional until a real codeplug dump confirms them.
 * That confirmation is the Phase 1 exit criterion.
 */
export const DM32UV_CAPABILITIES: RadioCapabilities = {
  model: 'Baofeng DM-32UV',
  txRanges: [
    { startHz: 136_000_000, endHz: 174_000_000 },
    { startHz: 400_000_000, endHz: 480_000_000 },
  ],
  powerLevelW: { low: 1, medium: 2.5, high: 5 },
  maxChannelNameLength: 16,
  supportedModes: ['FM', 'NFM', 'AM', 'DMR'],
  powerFiguresProvisional: true,
};

/** Maps the radio-facing mode enum onto the regulatory emission vocabulary. */
function toEmissionMode(mode: ChannelMode): EmissionMode {
  return mode;
}

export interface OperatorProfile {
  readonly licenseClass: LicenseClass;
  /** Which service the radio is being operated under, for shared frequencies. */
  readonly serviceProfile?: ServiceId;
}

export interface ChannelCheckResult {
  /** Problems that would corrupt the codeplug or exceed the hardware. */
  readonly hardwareErrors: readonly string[];
  /** The regulatory verdict, or null when the channel is receive-only. */
  readonly legal: ValidationResult | null;
  /** True only when the hardware accepts it and transmitting is permitted. */
  readonly writable: boolean;
}

/** Checks a channel against both the hardware limits and the regulations. */
export function checkChannel(
  channel: Channel,
  capabilities: RadioCapabilities,
  operator: OperatorProfile,
): ChannelCheckResult {
  const hardwareErrors: string[] = [];

  if (channel.name.length > capabilities.maxChannelNameLength) {
    hardwareErrors.push(
      `Channel name "${channel.name}" is ${channel.name.length} characters; ` +
        `${capabilities.model} allows ${capabilities.maxChannelNameLength}.`,
    );
  }
  if (!capabilities.supportedModes.includes(channel.mode)) {
    hardwareErrors.push(`${capabilities.model} does not support ${channel.mode} mode.`);
  }
  if (channel.mode === 'DMR' && channel.dmr === undefined) {
    hardwareErrors.push('DMR channel is missing its DMR settings (colour code, timeslot).');
  }

  // A receive-only channel needs no transmit range, so only check the range
  // when the channel will actually key up.
  if (!channel.rxOnly) {
    const inRange = capabilities.txRanges.some(
      (range) =>
        channel.txFrequencyHz >= range.startHz && channel.txFrequencyHz <= range.endHz,
    );
    if (!inRange) {
      hardwareErrors.push(
        `${(channel.txFrequencyHz / 1e6).toFixed(4)} MHz is outside the transmit ` +
          `range of ${capabilities.model}.`,
      );
    }
  }

  if (channel.rxOnly) {
    // Receive-only is always lawful, so there is nothing to authorize.
    return { hardwareErrors, legal: null, writable: hardwareErrors.length === 0 };
  }

  const powerW = capabilities.powerLevelW[channel.power];
  const legal = validateTransmit(US_DATASET, {
    txFrequencyHz: channel.txFrequencyHz,
    rxFrequencyHz: channel.rxFrequencyHz,
    mode: toEmissionMode(channel.mode),
    powerW,
    licenseClass: operator.licenseClass,
    ...(operator.serviceProfile !== undefined
      ? { serviceProfile: operator.serviceProfile }
      : {}),
  });

  const annotated: ValidationResult = capabilities.powerFiguresProvisional
    ? {
        ...legal,
        findings: legal.findings.map((finding) =>
          finding.code === 'exceedsPower'
            ? {
                ...finding,
                severity: 'warning' as const,
                message:
                  `${finding.message} (Power figures for ${capabilities.model} are ` +
                  `provisional and not yet confirmed against the hardware, so verify ` +
                  `the actual output before relying on this.)`,
              }
            : finding,
        ),
      }
    : legal;

  const permitted = !annotated.findings.some((finding) => finding.severity === 'error');

  return {
    hardwareErrors,
    legal: annotated,
    writable: hardwareErrors.length === 0 && permitted,
  };
}

/**
 * Adapter for `IRadioDriver.validateChannel`, which returns plain strings.
 *
 * Assumes no licence when none is supplied. That is the fail-closed choice: it
 * denies amateur privileges rather than granting privileges the operator may
 * not hold.
 */
export function validateChannelStrings(
  channel: Channel,
  capabilities: RadioCapabilities,
  operator: OperatorProfile = { licenseClass: 'none' },
): readonly string[] {
  const result = checkChannel(channel, capabilities, operator);
  return [
    ...result.hardwareErrors,
    ...(result.legal?.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message) ?? []),
  ];
}
