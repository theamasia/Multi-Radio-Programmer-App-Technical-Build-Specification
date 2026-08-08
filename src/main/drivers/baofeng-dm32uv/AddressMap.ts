/**
 * Translation between the codeplug's virtual addresses and the physical flash
 * addresses they are stored at.
 *
 * The DM-32UV scatters 4 KiB codeplug pages across flash in an order that
 * varies by firmware build, and records each page's virtual identity in the
 * final byte of the page itself. So the layout cannot be hardcoded -- it must
 * be discovered at connect time by probing every page. Ported from qdmr's
 * `DM32UV::AddressMap` (GPL-3.0).
 */

import { PAGE_SIZE } from './constants.js';

/** Page index, i.e. address >>> 12. */
type PagePrefix = number;

export class AddressMap {
  private readonly virtualByPhysical = new Map<PagePrefix, PagePrefix>();
  private readonly physicalByVirtual = new Map<PagePrefix, PagePrefix>();

  /** Records that the page at `physicalAddress` holds virtual `virtualAddress`. */
  map(physicalAddress: number, virtualAddress: number): void {
    const phys = physicalAddress >>> 12;
    const virt = virtualAddress >>> 12;
    const existing = this.physicalByVirtual.get(virt);
    if (existing !== undefined && existing !== phys) {
      throw new Error(
        `Virtual page 0x${virt.toString(16)} claimed by two physical pages ` +
          `(0x${existing.toString(16)} and 0x${phys.toString(16)}). ` +
          'The radio may have reported a corrupt page index.',
      );
    }
    this.virtualByPhysical.set(phys, virt);
    this.physicalByVirtual.set(virt, phys);
  }

  /** Resolves a virtual address to physical, or null when unmapped. */
  toPhysical(virtualAddress: number): number | null {
    const page = this.physicalByVirtual.get(virtualAddress >>> 12);
    if (page === undefined) return null;
    return (page << 12) | (virtualAddress % PAGE_SIZE);
  }

  /** Resolves a physical address to virtual, or null when unmapped. */
  toVirtual(physicalAddress: number): number | null {
    const page = this.virtualByPhysical.get(physicalAddress >>> 12);
    if (page === undefined) return null;
    return (page << 12) | (physicalAddress % PAGE_SIZE);
  }

  get size(): number {
    return this.virtualByPhysical.size;
  }

  /** Mapped virtual page base addresses, ascending. */
  virtualPages(): readonly number[] {
    return [...this.physicalByVirtual.keys()].sort((a, b) => a - b).map((p) => p << 12);
  }

  /** Mapped physical page base addresses, ascending. */
  physicalPages(): readonly number[] {
    return [...this.virtualByPhysical.keys()].sort((a, b) => a - b).map((p) => p << 12);
  }

  /**
   * Virtual pages that carry no allocated page, within the mapped range.
   *
   * These are expected, not an error. The radio allocates pages dynamically and
   * most of the address space is empty: on the captured factory radio only 71
   * of 200 pages carried a live logical ID, with 15 tagged `0x00` and 114
   * tagged `0xff`. A sparse result is the normal state of a healthy codeplug.
   *
   * Callers must not treat these offsets as data. The assembled image fills
   * them with {@link UNMAPPED_FILL} purely so it can be a flat array, and no
   * write may ever target an offset listed here.
   */
  unmappedVirtualPages(): readonly number[] {
    const pages = [...this.physicalByVirtual.keys()].sort((a, b) => a - b);
    const first = pages[0];
    const last = pages[pages.length - 1];
    if (first === undefined || last === undefined) return [];
    const present = new Set(pages);
    const gaps: number[] = [];
    for (let p = first; p <= last; p++) {
      if (!present.has(p)) gaps.push(p << 12);
    }
    return gaps;
  }
}
