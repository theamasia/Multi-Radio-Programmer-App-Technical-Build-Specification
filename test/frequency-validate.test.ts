/**
 * Regulatory validation tests.
 *
 * These assert the cases where a bug would approve an unlawful transmission,
 * not merely the happy path. Band edges are tested inclusively on both sides
 * plus one hertz outside, because an off-by-one here is the difference between
 * legal and illegal operation and is invisible in normal use.
 */

import { describe, expect, it } from 'vitest';
import { US_DATASET } from '../src/shared/frequency/data/index.js';
import { validateTransmit } from '../src/shared/frequency/validate.js';
import {
  DM32UV_CAPABILITIES,
  checkChannel,
  validateChannelStrings,
} from '../src/shared/frequency/channelCheck.js';
import type { LicenseClass, ServiceId } from '../src/shared/frequency/types.js';
import type { Channel } from '../src/shared/types/Channel.js';

const MHZ = 1_000_000;

function check(
  hz: number,
  options: {
    licenseClass?: LicenseClass;
    powerW?: number;
    mode?: 'FM' | 'NFM' | 'CW' | 'SSB' | 'DATA' | 'AM' | 'DMR';
    serviceProfile?: ServiceId;
    rxHz?: number;
  } = {},
) {
  return validateTransmit(US_DATASET, {
    txFrequencyHz: hz,
    rxFrequencyHz: options.rxHz ?? hz,
    mode: options.mode ?? 'FM',
    licenseClass: options.licenseClass ?? 'technician',
    ...(options.powerW !== undefined ? { powerW: options.powerW } : {}),
    ...(options.serviceProfile !== undefined
      ? { serviceProfile: options.serviceProfile }
      : {}),
  });
}

function errorCodes(hz: number, options: Parameters<typeof check>[1] = {}): string[] {
  return check(hz, options)
    .findings.filter((finding) => finding.severity === 'error')
    .map((finding) => finding.code);
}

describe('fail-closed behaviour', () => {
  it('rejects a frequency in no known allocation', () => {
    // 300 MHz is federal spectrum, in no service this application encodes.
    expect(errorCodes(300 * MHZ)).toContain('unknownAllocation');
  });

  it('rejects rather than permits when the frequency is merely unknown', () => {
    // The distinction that matters: absence of data must never read as consent.
    expect(check(300 * MHZ).permitted).toBe(false);
  });

  it('rejects transmit on the 2 m / 70 cm gap', () => {
    expect(errorCodes(200 * MHZ)).toContain('unknownAllocation');
  });
});

describe('amateur band edges', () => {
  it('permits both inclusive edges of 2 m', () => {
    expect(check(144 * MHZ, { mode: 'CW' }).permitted).toBe(true);
    expect(check(148 * MHZ).permitted).toBe(true);
  });

  it('rejects one hertz below and above 2 m', () => {
    expect(errorCodes(144 * MHZ - 1)).toContain('unknownAllocation');
    expect(errorCodes(148 * MHZ + 1)).toContain('unknownAllocation');
  });

  it('permits both inclusive edges of 70 cm', () => {
    expect(check(420 * MHZ).permitted).toBe(true);
    expect(check(450 * MHZ).permitted).toBe(true);
  });

  it('rejects one hertz outside 70 cm', () => {
    expect(errorCodes(420 * MHZ - 1)).toContain('unknownAllocation');
    expect(errorCodes(450 * MHZ + 1)).toContain('unknownAllocation');
  });
});

describe('licence class privileges', () => {
  it('denies a Technician the 20 m phone band', () => {
    expect(errorCodes(14.25 * MHZ, { licenseClass: 'technician', mode: 'SSB' })).toContain(
      'licenseInsufficient',
    );
  });

  it('permits a General the 20 m phone band', () => {
    expect(check(14.25 * MHZ, { licenseClass: 'general', mode: 'SSB' }).permitted).toBe(true);
  });

  it('denies an unlicensed operator any amateur frequency', () => {
    expect(errorCodes(146.52 * MHZ, { licenseClass: 'none' })).toContain(
      'licenseInsufficient',
    );
  });

  it('treats higher classes as covering lower privileges', () => {
    expect(check(3.9 * MHZ, { licenseClass: 'extra', mode: 'SSB' }).permitted).toBe(true);
  });

  it('denies a General the Extra-only bottom of 20 m', () => {
    expect(errorCodes(14.01 * MHZ, { licenseClass: 'general', mode: 'CW' })).toContain(
      'licenseInsufficient',
    );
  });
});

describe('power limits', () => {
  it('caps 30 m at 200 W even for Amateur Extra', () => {
    // The notable case: the highest licence class is still power limited here.
    expect(
      errorCodes(10.12 * MHZ, { licenseClass: 'extra', mode: 'CW', powerW: 1500 }),
    ).toContain('exceedsPower');
    expect(
      check(10.12 * MHZ, { licenseClass: 'extra', mode: 'CW', powerW: 200 }).permitted,
    ).toBe(true);
  });

  it('applies the 200 W Technician cap on a shared HF sub-band', () => {
    // Same frequency, different limit depending on who is operating.
    expect(
      errorCodes(7.05 * MHZ, { licenseClass: 'technician', mode: 'CW', powerW: 500 }),
    ).toContain('exceedsPower');
    expect(
      check(7.05 * MHZ, { licenseClass: 'general', mode: 'CW', powerW: 500 }).permitted,
    ).toBe(true);
  });

  it('permits 1500 W on a band with no special limit', () => {
    expect(
      check(14.25 * MHZ, { licenseClass: 'extra', mode: 'SSB', powerW: 1500 }).permitted,
    ).toBe(true);
  });
});

describe('60 m band, 2026 final rule', () => {
  it('limits the contiguous segment to 9.15 W ERP', () => {
    expect(
      check(5.36 * MHZ, { licenseClass: 'general', mode: 'SSB', powerW: 9.15 }).permitted,
    ).toBe(true);
    expect(
      errorCodes(5.36 * MHZ, { licenseClass: 'general', mode: 'SSB', powerW: 100 }),
    ).toContain('exceedsPower');
  });

  it('still allows 100 W ERP on the four retained discrete channels', () => {
    for (const centreKHz of [5332, 5348, 5373, 5405]) {
      expect(
        check(centreKHz * 1000, { licenseClass: 'general', mode: 'SSB', powerW: 100 })
          .permitted,
      ).toBe(true);
    }
  });

  it('no longer allows 100 W on the withdrawn 5358.5 kHz channel', () => {
    // 5358.5 kHz was a fifth discrete channel before the 2026 rule. It now sits
    // inside the contiguous band, so the 9.15 W limit applies instead of 100 W.
    const result = check(5_358_500, {
      licenseClass: 'general',
      mode: 'SSB',
      powerW: 100,
    });
    expect(result.permitted).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toContain('exceedsPower');
  });

  it('still permits 5358.5 kHz at the lower segment limit', () => {
    expect(
      check(5_358_500, { licenseClass: 'general', mode: 'SSB', powerW: 9 }).permitted,
    ).toBe(true);
  });

  it('denies Technicians 60 m entirely', () => {
    expect(
      errorCodes(5.36 * MHZ, { licenseClass: 'technician', mode: 'SSB', powerW: 5 }),
    ).toContain('licenseInsufficient');
  });

  it('rejects the gap between the band and the discrete channels', () => {
    // 5.34 MHz is inside 5330.5-5406.4 kHz but is neither the contiguous band
    // nor a discrete channel, so 97.303(h)(3) forbids it.
    expect(errorCodes(5.34 * MHZ, { licenseClass: 'general', mode: 'SSB' })).toContain(
      'unknownAllocation',
    );
  });
});

describe('shared GMRS and FRS frequencies', () => {
  it('applies the stricter FRS limit when no service is specified', () => {
    // 462.5625 MHz is GMRS 1 at 5 W ERP and FRS 1 at 2 W ERP simultaneously.
    const result = check(462.5625 * MHZ, { powerW: 5 });
    expect(result.findings.map((finding) => finding.code)).toContain('ambiguousService');
    expect(result.permitted).toBe(false);
  });

  it('permits 5 W once the operator declares GMRS', () => {
    expect(check(462.5625 * MHZ, { powerW: 5, serviceProfile: 'gmrs' }).permitted).toBe(
      true,
    );
  });

  it('holds FRS to 2 W on the same frequency', () => {
    expect(
      errorCodes(462.5625 * MHZ, { powerW: 5, serviceProfile: 'frs' }),
    ).toContain('exceedsPower');
  });

  it('allows 50 W on GMRS channel 15, where the basis is output power', () => {
    // 50 W here is transmitter output power, not ERP. Treating it as ERP would
    // wrongly reject a legal mobile installation.
    const result = check(462.55 * MHZ, { powerW: 50, serviceProfile: 'gmrs' });
    expect(result.permitted).toBe(true);
    expect(result.matched?.kind).toBe('fixedChannel');
  });

  it('limits GMRS channels 8-14 to half a watt', () => {
    expect(errorCodes(467.5625 * MHZ, { powerW: 5, serviceProfile: 'gmrs' })).toContain(
      'exceedsPower',
    );
  });
});

describe('MURS', () => {
  it('permits 2 W without a licence', () => {
    expect(
      check(151.82 * MHZ, { licenseClass: 'none', powerW: 2, serviceProfile: 'murs' })
        .permitted,
    ).toBe(true);
  });

  it('rejects above 2 W', () => {
    expect(
      errorCodes(151.82 * MHZ, { licenseClass: 'none', powerW: 5, serviceProfile: 'murs' }),
    ).toContain('exceedsPower');
  });
});

describe('receive-only allocations', () => {
  it('refuses transmit on NOAA weather frequencies', () => {
    const codes = errorCodes(162.4 * MHZ, { licenseClass: 'extra', powerW: 1 });
    expect(codes.length).toBeGreaterThan(0);
    expect(check(162.4 * MHZ, { licenseClass: 'extra' }).permitted).toBe(false);
  });

  it('refuses transmit on the marine distress frequency', () => {
    // Channel 16. Blocked for equipment-certification reasons, so even an
    // Amateur Extra licence must not unlock it.
    expect(check(156.8 * MHZ, { licenseClass: 'extra', powerW: 5 }).permitted).toBe(false);
  });

  it('blocks the whole marine range, not just enumerated channels', () => {
    expect(check(157.1 * MHZ, { licenseClass: 'extra' }).permitted).toBe(false);
  });
});

describe('channel-level checks against radio capabilities', () => {
  function channel(overrides: Partial<Channel> = {}): Channel {
    return {
      index: 0,
      name: 'TEST',
      rxFrequencyHz: 146.52 * MHZ,
      txFrequencyHz: 146.52 * MHZ,
      mode: 'NFM',
      power: 'high',
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      rxOnly: false,
      ...overrides,
    };
  }

  it('accepts a legal 2 m simplex channel for a Technician', () => {
    const result = checkChannel(channel(), DM32UV_CAPABILITIES, {
      licenseClass: 'technician',
    });
    expect(result.hardwareErrors).toEqual([]);
    expect(result.writable).toBe(true);
  });

  it('reports a hardware range error separately from a legal one', () => {
    // 14.25 MHz is a legal frequency for a General, but this radio cannot
    // transmit there. The two failures must not be conflated.
    const result = checkChannel(
      channel({ rxFrequencyHz: 14.25 * MHZ, txFrequencyHz: 14.25 * MHZ, mode: 'FM' }),
      DM32UV_CAPABILITIES,
      { licenseClass: 'general' },
    );
    expect(result.hardwareErrors.length).toBe(1);
    expect(result.writable).toBe(false);
  });

  it('allows a receive-only channel outside the transmit range', () => {
    const result = checkChannel(
      channel({
        rxFrequencyHz: 162.4 * MHZ,
        txFrequencyHz: 162.4 * MHZ,
        rxOnly: true,
        name: 'NOAA1',
      }),
      DM32UV_CAPABILITIES,
      { licenseClass: 'none' },
    );
    expect(result.legal).toBeNull();
    expect(result.writable).toBe(true);
  });

  it('rejects an over-long channel name', () => {
    const result = checkChannel(
      channel({ name: 'A'.repeat(20) }),
      DM32UV_CAPABILITIES,
      { licenseClass: 'technician' },
    );
    expect(result.hardwareErrors.length).toBe(1);
    expect(result.writable).toBe(false);
  });

  it('flags a DMR channel with no DMR settings', () => {
    const result = checkChannel(channel({ mode: 'DMR' }), DM32UV_CAPABILITIES, {
      licenseClass: 'technician',
    });
    expect(result.hardwareErrors.some((error) => error.includes('DMR settings'))).toBe(
      true,
    );
  });

  it('assumes no licence when none is supplied', () => {
    // Defaulting to unlicensed denies amateur privileges rather than granting
    // privileges the operator may not hold.
    const errors = validateChannelStrings(channel(), DM32UV_CAPABILITIES);
    expect(errors.length).toBeGreaterThan(0);
  });
});
