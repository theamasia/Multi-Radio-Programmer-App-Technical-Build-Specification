import { describe, expect, it } from 'vitest';
import { AddressMap } from '../src/main/drivers/baofeng-dm32uv/AddressMap.js';

describe('AddressMap', () => {
  it('translates both directions and preserves the offset within a page', () => {
    const map = new AddressMap();
    map.map(0x27000, 0x03000);
    expect(map.toVirtual(0x27abc)).toBe(0x03abc);
    expect(map.toPhysical(0x03abc)).toBe(0x27abc);
  });

  it('returns null for unmapped addresses instead of guessing', () => {
    const map = new AddressMap();
    expect(map.toPhysical(0x99000)).toBeNull();
    expect(map.toVirtual(0x99000)).toBeNull();
  });

  it('rejects two physical pages claiming one virtual page', () => {
    const map = new AddressMap();
    map.map(0x1000, 0x5000);
    expect(() => map.map(0x2000, 0x5000)).toThrow(/claimed by two physical pages/i);
  });

  it('tolerates an idempotent remap of the same pair', () => {
    const map = new AddressMap();
    map.map(0x1000, 0x5000);
    expect(() => map.map(0x1000, 0x5000)).not.toThrow();
    expect(map.size).toBe(1);
  });

  it('lists virtual pages in ascending order regardless of insertion order', () => {
    const map = new AddressMap();
    map.map(0x1000, 0x9000);
    map.map(0x2000, 0x3000);
    expect(map.virtualPages()).toEqual([0x3000, 0x9000]);
  });

  it('reports unallocated pages inside the mapped range', () => {
    const map = new AddressMap();
    map.map(0x1000, 0x1000);
    map.map(0x2000, 0x3000);
    expect(map.unmappedVirtualPages()).toEqual([0x2000]);
  });

  it('reports nothing unallocated for a fully allocated range', () => {
    const map = new AddressMap();
    map.map(0x8000, 0x1000);
    map.map(0x9000, 0x2000);
    map.map(0xa000, 0x3000);
    expect(map.unmappedVirtualPages()).toEqual([]);
  });

  it('reports nothing unallocated for an empty map', () => {
    expect(new AddressMap().unmappedVirtualPages()).toEqual([]);
  });
});
