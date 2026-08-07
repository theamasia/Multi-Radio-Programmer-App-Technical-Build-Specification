import { CHIPSETS, type ChipsetDescriptor, type ChipsetId } from '../../shared/constants/chipsets.js';

export interface RawPortInfo {
  readonly path: string;
  readonly vendorId?: string | undefined;
  readonly productId?: string | undefined;
  readonly manufacturer?: string | undefined;
}

export interface DetectedPort extends RawPortInfo {
  readonly chipset: ChipsetId;
  readonly chipsetName: string;
  /** Vendor driver page, offered when the port looks misconfigured. */
  readonly driverUrl: string | null;
}

function normalizeId(id: string | undefined): string | null {
  if (!id) return null;
  return id.replace(/^0x/i, '').toLowerCase().padStart(4, '0');
}

export function identifyChipset(port: RawPortInfo): ChipsetDescriptor | null {
  const vid = normalizeId(port.vendorId);
  const pid = normalizeId(port.productId);
  if (!vid) return null;

  // Match on vendor ID first; product IDs vary across cable revisions and an
  // unknown PID from a known vendor is still almost certainly that chipset.
  const byVendor = CHIPSETS.filter((c) => c.vendorIds.includes(vid));
  if (byVendor.length === 0) return null;
  if (pid) {
    const exact = byVendor.find((c) => c.productIds.includes(pid));
    if (exact) return exact;
  }
  return byVendor[0] ?? null;
}

export function describePort(port: RawPortInfo): DetectedPort {
  const chipset = identifyChipset(port);
  return {
    ...port,
    chipset: chipset?.id ?? 'unknown',
    chipsetName: chipset?.displayName ?? 'Unknown or generic serial device',
    driverUrl: chipset?.driverUrl ?? null,
  };
}
