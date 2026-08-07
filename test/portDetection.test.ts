import { describe, expect, it } from 'vitest';
import { describePort, identifyChipset } from '../src/main/serial/portDetection.js';

describe('identifyChipset', () => {
  it('identifies a CH340 cable by vendor and product id', () => {
    const chipset = identifyChipset({ path: 'COM3', vendorId: '1A86', productId: '7523' });
    expect(chipset?.id).toBe('ch340');
  });

  it('tolerates 0x-prefixed and short ids', () => {
    const chipset = identifyChipset({ path: 'COM3', vendorId: '0x10c4', productId: 'ea60' });
    expect(chipset?.id).toBe('cp210x');
  });

  it('falls back to the vendor match when the product id is unknown', () => {
    const chipset = identifyChipset({ path: 'COM3', vendorId: '1a86', productId: 'ffff' });
    expect(chipset?.id).toBe('ch340');
  });

  it('returns null for an unrecognized vendor', () => {
    expect(identifyChipset({ path: 'COM3', vendorId: 'dead', productId: 'beef' })).toBeNull();
  });

  it('returns null when no vendor id is reported', () => {
    expect(identifyChipset({ path: 'COM3' })).toBeNull();
  });
});

describe('describePort', () => {
  it('surfaces a driver url for a known chipset', () => {
    const port = describePort({ path: 'COM4', vendorId: '067b', productId: '2303' });
    expect(port.chipset).toBe('pl2303');
    expect(port.driverUrl).toContain('prolific');
  });

  it('marks unknown devices without a driver url', () => {
    const port = describePort({ path: 'COM9' });
    expect(port.chipset).toBe('unknown');
    expect(port.driverUrl).toBeNull();
  });
});
