/**
 * Diffs two codeplug images and reports what changed, by structure.
 *
 * The point is to turn a known edit made on the radio into ground truth about
 * the byte layout. If you rename one scan list and re-dump, the bytes that
 * moved are the scan list name field -- no inference required.
 *
 * This is also the safety instrument for Phase 3. Before the app writes
 * anything, it should be able to show that patching an image produces the same
 * byte delta the radio itself produces for the same edit.
 *
 *   npm run diff -- test/fixtures/a.bin test/fixtures/b.bin
 *   npm run diff -- a.bin b.bin --find 3141592
 *
 * Usage:
 *   --find <n>      locate an integer anywhere in either image, tried as
 *                   16/24/32-bit little-endian and as packed BCD. Use this to
 *                   find a structure whose location is unknown, by setting a
 *                   distinctive value on the radio and searching for it.
 *   --context <n>   bytes of unchanged context around each run (default 4)
 */

import { readFileSync } from 'node:fs';
import { PAGE_SIZE } from '../src/main/drivers/baofeng-dm32uv/constants.js';

/** Which structure lives on a logical page, for annotating the output. */
function describePage(id: number): string {
  if (id === 0x04) return 'radio settings';
  if (id === 0x0f) return 'RX groups';
  if (id === 0x11) return 'scan lists';
  if (id >= 0x12 && id <= 0x41) return `channels (bank ${id - 0x12 + 1})`;
  if (id === 0x42) return 'channel TX contact indices';
  if (id === 0x44) return 'contacts';
  if (id >= 0x5c && id <= 0x64) return `zones (bank ${id - 0x5c + 1})`;
  return 'unknown purpose';
}

interface Run {
  readonly start: number;
  readonly end: number;
}

/** Groups differing bytes into runs, merging runs separated by a small gap. */
function changedRuns(a: Uint8Array, b: Uint8Array, mergeGap: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  let lastDiff = -1;
  const length = Math.max(a.length, b.length);

  for (let i = 0; i <= length; i++) {
    const differs = i < length && a[i] !== b[i];
    if (differs) {
      if (start === -1) start = i;
      lastDiff = i;
    } else if (start !== -1 && (i - lastDiff > mergeGap || i === length)) {
      runs.push({ start, end: lastDiff + 1 });
      start = -1;
    }
  }
  return runs;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function ascii(bytes: Uint8Array): string {
  return [...bytes].map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.')).join('');
}

/** Every byte encoding of a value worth searching for. */
function encodings(value: number): { label: string; bytes: Uint8Array }[] {
  const out: { label: string; bytes: Uint8Array }[] = [];
  if (value <= 0xffff) {
    out.push({ label: 'u16 LE', bytes: Uint8Array.from([value & 0xff, (value >> 8) & 0xff]) });
  }
  if (value <= 0xffffff) {
    out.push({
      label: 'u24 LE',
      bytes: Uint8Array.from([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff]),
    });
  }
  out.push({
    label: 'u32 LE',
    bytes: Uint8Array.from([
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >>> 24) & 0xff,
    ]),
  });

  const digits = String(value).padStart(8, '0');
  if (digits.length === 8) {
    const bcd: number[] = [];
    for (let i = 6; i >= 0; i -= 2) {
      bcd.push(Number(digits[i]) * 16 + Number(digits[i + 1]));
    }
    out.push({ label: 'packed BCD (frequency codec)', bytes: Uint8Array.from(bcd) });
  }
  return out;
}

function findAll(image: Uint8Array, needle: Uint8Array): number[] {
  const hits: number[] = [];
  outer: for (let i = 0; i + needle.length <= image.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (image[i + j] !== needle[j]) continue outer;
    }
    hits.push(i);
  }
  return hits;
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith('--'));
  if (positional.length < 2) {
    console.error('Usage: npm run diff -- <before.bin> <after.bin> [--find <n>] [--context <n>]');
    process.exit(2);
  }

  const flag = (name: string): string | undefined => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
  };

  const [pathA, pathB] = positional as [string, string];
  const a = new Uint8Array(readFileSync(pathA));
  const b = new Uint8Array(readFileSync(pathB));
  const context = Number(flag('context') ?? 4);

  console.log(`before: ${pathA} (${a.length} bytes)`);
  console.log(`after:  ${pathB} (${b.length} bytes)`);

  if (a.length !== b.length) {
    console.log(`\n⚠️  Sizes differ by ${Math.abs(a.length - b.length)} bytes.`);
  }

  const runs = changedRuns(a, b, 8);
  const changedBytes = runs.reduce((sum, run) => sum + (run.end - run.start), 0);

  if (runs.length === 0) {
    console.log('\nThe images are identical.');
    console.log(
      'If you expected a change, the radio may not have committed it. Some models only\n' +
        'flush settings to flash on power-off rather than on leaving the menu.',
    );
  } else {
    console.log(`\n${changedBytes} byte(s) changed in ${runs.length} run(s):\n`);

    const pages = new Map<number, number>();
    for (const run of runs) {
      const from = Math.max(0, run.start - context);
      const to = Math.min(a.length, run.end + context);
      const page = Math.floor(run.start / PAGE_SIZE);
      pages.set(page, (pages.get(page) ?? 0) + (run.end - run.start));

      const offset = run.start % PAGE_SIZE;
      console.log(
        `0x${run.start.toString(16).padStart(5, '0')}  ` +
          `page 0x${page.toString(16).padStart(2, '0')} +0x${offset.toString(16).padStart(3, '0')}  ` +
          `${describePage(page)}  (${run.end - run.start} bytes)`,
      );
      console.log(`    before  ${hex(a.subarray(from, to))}  |${ascii(a.subarray(from, to))}|`);
      console.log(`    after   ${hex(b.subarray(from, to))}  |${ascii(b.subarray(from, to))}|`);
      console.log();
    }

    console.log('Pages touched:');
    for (const [page, count] of [...pages].sort((x, y) => x[0] - y[0])) {
      console.log(
        `  page 0x${page.toString(16).padStart(2, '0')}  ${String(count).padStart(5)} bytes  ${describePage(page)}`,
      );
    }
  }

  const find = flag('find');
  if (find !== undefined) {
    const value = Number(find);
    console.log(`\nSearching for ${value} in the after image:`);
    for (const { label, bytes } of encodings(value)) {
      const hits = findAll(b, bytes);
      const shown = hits.slice(0, 12).map((at) => `0x${at.toString(16)}`).join(', ');
      console.log(
        `  ${label.padEnd(28)} ${hex(bytes).padEnd(12)} ` +
          (hits.length === 0
            ? 'not found'
            : `${hits.length} hit(s): ${shown}${hits.length > 12 ? ' ...' : ''}`),
      );
    }
    console.log(
      '\nA value with many hits is probably a coincidence. Prefer distinctive values,\n' +
        'and cross-reference against the changed runs above.',
    );
  }
}

main();
