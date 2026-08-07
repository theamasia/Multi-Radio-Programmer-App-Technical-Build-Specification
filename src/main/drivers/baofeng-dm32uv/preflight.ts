/**
 * Preflight conditions for a DM-32UV programming session.
 *
 * The DM-32UV fails to communicate under several specific and entirely
 * non-obvious conditions, and the symptom is always the same opaque serial
 * timeout. Surfacing these as an explicit checklist before connecting turns a
 * mystery failure into a two-second fix.
 *
 * Sources: https://www.we8chz.org/?p=966 and
 * https://github.com/infamy/DM32-Protocol-Spec
 */

export interface PreflightItem {
  readonly id: string;
  readonly requirement: string;
  readonly why: string;
}

export const DM32UV_PREFLIGHT: readonly PreflightItem[] = [
  {
    id: 'analog-vfo',
    requirement: 'Set VFO A to an analog channel or frequency, not a DMR one.',
    why: 'The radio will not enter program mode while the active VFO is on a digital channel.',
  },
  {
    id: 'volume',
    requirement: 'Set the volume knob to roughly 50%.',
    why: 'Programming cables for this family tap the speaker/mic lines, so signalling levels depend on volume position.',
  },
  {
    id: 'not-charging',
    requirement: 'Unplug the radio from any charger or USB power source.',
    why: 'Charging introduces RF interference that corrupts the serial link.',
  },
  {
    id: 'cable-seated',
    requirement: 'Push the programming cable firmly into the radio until it seats.',
    why: 'A partially seated Kenwood-style plug connects audio but not data, so the port opens and then times out.',
  },
  {
    id: 'radio-on',
    requirement: 'Power the radio on before connecting.',
    why: 'The handshake requires a running radio; the cable alone will enumerate a COM port regardless.',
  },
];

/**
 * Guidance for a failed session, keyed to what actually went wrong.
 *
 * Returned as structured text rather than logged, so the UI can present it
 * next to the failure instead of burying it in a console.
 */
export function explainFailure(error: unknown): readonly string[] {
  const message = error instanceof Error ? error.message : String(error);

  if (/did not respond to detection/i.test(message)) {
    return [
      'The radio never answered the detection command.',
      ...DM32UV_PREFLIGHT.map((item) => item.requirement),
      'If all of the above are correct, try a different USB port and confirm the cable chipset driver is installed.',
    ];
  }
  if (/timed out/i.test(message)) {
    return [
      'The radio stopped responding partway through the exchange.',
      'Power cycle the radio, then reconnect. Do not leave it in program mode.',
      'Confirm the radio is not charging over USB, which is a common cause of mid-transfer corruption.',
    ];
  }
  if (/address byte order|out of sync/i.test(message)) {
    return [
      'The data stream desynchronized, which points at a protocol-level problem rather than a cable problem.',
      'Do not attempt to write to the radio. Capture the session log and review before retrying.',
    ];
  }
  if (/model/i.test(message)) {
    return [
      'A radio responded, but it is not a DM-32UV.',
      'This driver refuses to talk to unknown models because a wrong memory map can render a radio inoperable.',
    ];
  }
  return [`Unexpected failure: ${message}`];
}
