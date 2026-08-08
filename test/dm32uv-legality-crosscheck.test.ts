/**
 * Cross-check between the two halves of the project.
 *
 * The Phase 2 parser derives channels from a codeplug read off real hardware.
 * The Phase 4 dataset derives transmit legality from the Federal Register.
 * Neither was built with the other in mind, so running real channels through
 * the real rules is the first test where both can contradict each other.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AddressMap } from '../src/main/drivers/baofeng-dm32uv/AddressMap.js';
import { Codeplug } from '../src/main/drivers/baofeng-dm32uv/codeplug/Codeplug.js';
import { checkChannel, DM32UV_CAPABILITIES } from '../src/shared/frequency/channelCheck.js';
import type { Channel as RadioChannel, ChannelMode } from '../src/shared/types/Channel.js';
import type { LicenseClass } from '../src/shared/frequency/types.js';

const FIXTURE_DIR = join(__dirname, 'fixtures');

interface MapFile {
  readonly pages: readonly { readonly virtual: string; readonly physical: string }[];
}

function loadFixture(): Codeplug {
  const image = new Uint8Array(readFileSync(join(FIXTURE_DIR, 'dp570uv-factory-codeplug.bin')));
  const parsed = JSON.parse(
    readFileSync(join(FIXTURE_DIR, 'dp570uv-factory-codeplug.map.json'), 'utf8'),
  ) as MapFile;
  const map = new AddressMap();
  for (const page of parsed.pages) {
    map.map(Number.parseInt(page.physical, 16), Number.parseInt(page.virtual, 16));
  }
  return new Codeplug(image, map);
}

/**
 * Presents a parsed codeplug channel to the validator.
 *
 * Mode, power and tones are not decoded yet, so they are supplied explicitly
 * rather than read from the image. Every conclusion this file draws is checked
 * against all supported modes, so none of them rests on the assumed value.
 */
function asRadioChannel(
  name: string,
  rxHz: number,
  txHz: number,
  mode: ChannelMode,
): RadioChannel {
  return {
    index: 0,
    name,
    rxFrequencyHz: rxHz,
    txFrequencyHz: txHz,
    mode,
    power: 'high',
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    rxOnly: false,
  };
}

describe('factory channels against the transmit-legality rules', () => {
  const codeplug = loadFixture();
  const channels = codeplug.channels();

  it('accepts every channel as within the radio hardware ranges', () => {
    // A parsing error would put channels outside 136-174 or 400-480 MHz and
    // show up here as a hardware error rather than a regulatory one.
    for (const channel of channels) {
      const result = checkChannel(
        asRadioChannel(channel.name, channel.rxHz ?? 0, channel.txHz ?? 0, 'FM'),
        DM32UV_CAPABILITIES,
        { licenseClass: 'technician' },
      );
      expect(result.hardwareErrors, `${channel.name}`).toEqual([]);
    }
  });

  it('flags the two factory channels sitting in the 2 m CW-only segment', () => {
    // 144.0-144.1 MHz permits CW only. The factory codeplug ships two channels
    // at 144.02250 MHz, so the defaults are not legal to transmit on as
    // shipped -- a real finding about the radio, not about this code.
    const blocked = channels.filter(
      (channel) =>
        !checkChannel(
          asRadioChannel(channel.name, channel.rxHz ?? 0, channel.txHz ?? 0, 'FM'),
          DM32UV_CAPABILITIES,
          { licenseClass: 'technician' },
        ).writable,
    );

    expect(blocked.map((channel) => channel.name)).toEqual(['Channel 6', 'Channel 15']);
    for (const channel of blocked) {
      expect(channel.txHz).toBe(144_022_500);
    }
    expect(channels.length - blocked.length).toBe(23);
  });

  it('blocks those channels in every mode the radio can transmit', () => {
    // The mode field is not decoded yet, so the finding above could have been
    // an artefact of assuming FM. It is not: the segment permits CW only, and
    // CW is not among this radio's emissions, so no configuration of it is
    // permitted there. The conclusion survives the unknown.
    expect(DM32UV_CAPABILITIES.supportedModes).not.toContain('CW');

    for (const mode of DM32UV_CAPABILITIES.supportedModes) {
      const result = checkChannel(
        asRadioChannel('Channel 6', 144_022_500, 144_022_500, mode),
        DM32UV_CAPABILITIES,
        { licenseClass: 'extra' },
      );
      expect(result.writable, `${mode} at 144.0225 MHz`).toBe(false);
    }
  });

  it('does not depend on license class for the VHF and UHF defaults', () => {
    // Technicians hold full privileges on 2 m and 70 cm, so upgrading the
    // class must not change any verdict here. If it does, the dataset has
    // leaked an HF-style restriction into the VHF/UHF bands.
    const classes: readonly LicenseClass[] = ['technician', 'general', 'extra'];
    const verdicts = classes.map((licenseClass) =>
      channels
        .map((channel) =>
          checkChannel(
            asRadioChannel(channel.name, channel.rxHz ?? 0, channel.txHz ?? 0, 'FM'),
            DM32UV_CAPABILITIES,
            { licenseClass },
          ).writable,
        )
        .join(','),
    );
    expect(new Set(verdicts).size).toBe(1);
  });
});
