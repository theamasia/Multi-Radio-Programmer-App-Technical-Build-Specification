/**
 * Standalone DM-32UV codeplug dump tool.
 *
 * Read-only by construction: it never calls any write path. Its output is the
 * fixture that Phase 2 codeplug parsing will be developed against, so this is
 * the first point where the ported protocol meets real hardware.
 *
 * Usage:
 *   npm run dump                       # auto-detect the port
 *   npm run dump -- --port COM5        # or name it explicitly
 *   npm run dump -- --list             # just list candidate ports
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AddressMap } from '../src/main/drivers/baofeng-dm32uv/AddressMap.js';
import { DM32UV_PREFLIGHT, explainFailure } from '../src/main/drivers/baofeng-dm32uv/preflight.js';
import { DM32UVSession } from '../src/main/drivers/baofeng-dm32uv/session.js';
import { listPorts, NodeSerialTransport } from '../src/main/serial/SerialManager.js';

const USB_VENDOR_ID = '067b';
const USB_PRODUCT_IDS = new Set(['23a3', '2303', '23c3']);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const explicitPort = readFlag(args, '--port');
  const outPath = resolve(
    readFlag(args, '--out') ?? `test/fixtures/dm32uv-codeplug-${timestamp()}.bin`,
  );

  const ports = await listPorts();
  if (args.includes('--list')) {
    printPorts(ports);
    return;
  }

  console.log('DM-32UV codeplug dump (read-only)\n');
  console.log('Before continuing, confirm each of the following:');
  for (const item of DM32UV_PREFLIGHT) {
    console.log(`  [ ] ${item.requirement}`);
    console.log(`        ${item.why}`);
  }
  console.log('');

  const portPath = explicitPort ?? autoDetect(ports);
  if (portPath === null) {
    printPorts(ports);
    fail(
      'Could not find a Prolific PL2303 programming cable (USB 067b:23a3). ' +
        'Pass --port <path> to override.',
    );
  }
  console.log(`Using port: ${portPath}\n`);

  const transport = new NodeSerialTransport(portPath);
  const session = new DM32UVSession(transport, {
    debug: (message) => console.log(`  ${message}`),
    warn: (message) => console.warn(`  WARNING: ${message}`),
  });

  try {
    console.log('Connecting...');
    const identity = await session.connect();
    console.log(`  Model:    ${identity.modelId}`);
    console.log(`  Firmware: ${identity.firmwareVersion}`);
    console.log(
      `  Codeplug: 0x${hex(identity.codeplugMemory.startAddress)}` +
        `-0x${hex(identity.codeplugMemory.endAddress)}`,
    );
    if (!identity.firmwareKnown) {
      console.warn(
        '  WARNING: this firmware version was not seen during porting. The dump is\n' +
          '  still safe (read-only), but treat the memory layout as unverified.',
      );
    }

    console.log('\nEntering program mode...');
    await session.enterProgramMode();

    console.log('\nReading codeplug. This takes a couple of minutes.');
    let lastShown = -1;
    const { image, map } = await session.readCodeplugImage((percent) => {
      const step = Math.floor(percent / 5) * 5;
      if (step > lastShown) {
        lastShown = step;
        process.stdout.write(`\r  ${step}%   `);
      }
    });
    process.stdout.write('\r  100%  \n');

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, image);

    const mapPath = outPath.replace(/\.bin$/, '.map.json');
    writeFileSync(mapPath, JSON.stringify(describeMap(map), null, 2));

    console.log(`\nWrote ${image.length} bytes to ${outPath}`);
    console.log(`Wrote address map to ${mapPath}`);
    console.log(`\n${summarize(image)}`);
    console.log(
      '\nNext: commit this fixture, then Phase 2 develops codeplug parsing against\n' +
        'it and proves a byte-identical round-trip before anything is ever written.',
    );
  } catch (error) {
    console.error('\nDump failed.\n');
    for (const line of explainFailure(error)) console.error(`  ${line}`);
    process.exitCode = 1;
  } finally {
    await session.close().catch(() => undefined);
    console.log('\nPort closed and radio reset. Power cycle the radio if it looks stuck.');
  }
}

function describeMap(map: AddressMap): unknown {
  return {
    pageCount: map.size,
    pages: map.virtualPages().map((virtual) => ({
      virtual: `0x${hex(virtual)}`,
      physical: `0x${hex(map.toPhysical(virtual) ?? 0)}`,
    })),
    gaps: map.virtualGaps().map((gap) => `0x${hex(gap)}`),
  };
}

/** A quick sanity read so an obviously wrong dump is caught immediately. */
function summarize(image: Uint8Array): string {
  let zero = 0;
  let ff = 0;
  for (const byte of image) {
    if (byte === 0x00) zero++;
    else if (byte === 0xff) ff++;
  }
  const pct = (n: number): string => `${((n / image.length) * 100).toFixed(1)}%`;
  const lines = [
    'Sanity check:',
    `  0x00 bytes: ${pct(zero)}   0xff bytes: ${pct(ff)}`,
  ];
  if (zero + ff === image.length) {
    lines.push('  SUSPECT: the image contains no real data. Do not trust this dump.');
  } else {
    lines.push('  Image contains non-trivial data, consistent with a real codeplug.');
  }
  return lines.join('\n');
}

function autoDetect(ports: readonly { path: string; vendorId?: string; productId?: string }[]):
  | string
  | null {
  const match = ports.find(
    (port) =>
      port.vendorId?.toLowerCase() === USB_VENDOR_ID &&
      USB_PRODUCT_IDS.has(port.productId?.toLowerCase() ?? ''),
  );
  return match?.path ?? null;
}

function printPorts(ports: readonly { path: string; vendorId?: string; productId?: string }[]): void {
  if (ports.length === 0) {
    console.log('No serial ports found at all. The cable is not enumerating.');
    return;
  }
  console.log('Serial ports detected:');
  for (const port of ports) {
    const usb =
      port.vendorId !== undefined ? ` (USB ${port.vendorId}:${port.productId ?? '????'})` : '';
    console.log(`  ${port.path}${usb}`);
  }
}

function readFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hex(value: number): string {
  return value.toString(16).padStart(6, '0');
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

void main();
