import { describe, expect, it } from 'vitest';
import { DM32UVSession } from '../src/main/drivers/baofeng-dm32uv/session.js';
import { explainFailure } from '../src/main/drivers/baofeng-dm32uv/preflight.js';
import { FakeRadio } from './helpers/FakeRadio.js';

/** Skip all protocol delays so tests run instantly. */
const noDelay = async (): Promise<void> => undefined;

function session(radio: FakeRadio): DM32UVSession {
  return new DM32UVSession(radio, { debug: () => {}, warn: () => {} }, noDelay);
}

describe('DM32UVSession.connect', () => {
  it('identifies the radio and reads both memory regions', async () => {
    const radio = new FakeRadio();
    const identity = await session(radio).connect();

    expect(identity.modelId).toBe('DP570UV');
    expect(identity.firmwareVersion).toBe('DM32.01.L01.048');
    expect(identity.codeplugMemory).toEqual({ startAddress: 0, endAddress: 0x3000 });
    expect(identity.firmwareKnown).toBe(true);
  });

  it('opens at 115200 baud with RTS low and DTR high', async () => {
    const radio = new FakeRadio();
    await session(radio).connect();

    expect(radio.opened[0]?.baudRate).toBe(115200);
    expect(radio.signalHistory[0]).toEqual({ rts: false, dtr: true });
  });

  it('retries detection before giving up', async () => {
    const radio = new FakeRadio({ failDetectAttempts: 2 });
    const identity = await session(radio).connect();
    expect(identity.modelId).toBe('DP570UV');
  });

  it('fails with guidance after exhausting detection retries', async () => {
    const radio = new FakeRadio({ failDetectAttempts: 99 });
    const s = session(radio);
    await expect(s.connect()).rejects.toThrow(/did not respond to detection after 3 attempts/i);
    expect(s.currentState).toBe('error');
  });

  it('refuses to continue against an unrecognized model', async () => {
    const radio = new FakeRadio({ modelId: 'OTHER99' });
    await expect(session(radio).connect()).rejects.toThrow(/reports model "OTHER99"/);
  });

  it('flags an unknown firmware version without failing the connection', async () => {
    const radio = new FakeRadio({ firmwareVersion: 'DM99.99.X01.000' });
    const identity = await session(radio).connect();
    expect(identity.firmwareKnown).toBe(false);
  });

  it('rejects a second connect on the same session', async () => {
    const radio = new FakeRadio();
    const s = session(radio);
    await s.connect();
    await expect(s.connect()).rejects.toThrow(/already systemInfo/i);
  });
});

describe('DM32UVSession program mode', () => {
  it('enters program mode after connecting', async () => {
    const s = session(new FakeRadio());
    await s.connect();
    await s.enterProgramMode();
    expect(s.currentState).toBe('program');
  });

  it('surfaces a NAK from the enter-program-mode command', async () => {
    const s = session(new FakeRadio({ nakEnterProgramMode: true }));
    await s.connect();
    await expect(s.enterProgramMode()).rejects.toThrow(/replied 0xc0, expected 0x06/i);
  });

  it('refuses to enter program mode before identification', async () => {
    const s = session(new FakeRadio());
    await expect(s.enterProgramMode()).rejects.toThrow(/connect\(\) first/);
  });
});

describe('DM32UVSession address map', () => {
  it('discovers a page mapping from per-page marker bytes', async () => {
    const s = session(new FakeRadio());
    await s.connect();
    const map = await s.buildAddressMap();

    expect(map.size).toBe(3);
    // Physical page 2 declares virtual index 3.
    expect(map.toVirtual(0x002000)).toBe(0x003000);
  });

  it('never maps virtual page 0, because 0x00 is the unallocated sentinel', async () => {
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0x00],
        [0x001000, 0x01],
        [0x002000, 0x02],
      ]),
    });
    const s = session(radio);
    await s.connect();
    const map = await s.buildAddressMap();

    expect(map.toPhysical(0x000000)).toBeNull();
    expect(map.size).toBe(2);
  });

  it('skips unallocated pages marked 0x00 or 0xff', async () => {
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0x05],
        [0x001000, 0xff], // unallocated
        [0x002000, 0x00], // unallocated
      ]),
    });
    const s = session(radio);
    await s.connect();
    const map = await s.buildAddressMap();

    expect(map.size).toBe(1);
    expect(map.toPhysical(0x005000)).toBe(0x000000);
  });

  it('reports progress monotonically up to 100', async () => {
    const s = session(new FakeRadio());
    await s.connect();
    const seen: number[] = [];
    await s.buildAddressMap((p) => seen.push(p));

    expect(seen.at(-1)).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('handles a scattered, non-identity layout', async () => {
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0x03],
        [0x001000, 0x01],
        [0x002000, 0x02],
      ]),
    });
    const s = session(radio);
    await s.connect();
    const map = await s.buildAddressMap();

    expect(map.toPhysical(0x003000)).toBe(0x000000);
    expect(map.toPhysical(0x001000)).toBe(0x001000);
    expect(map.toPhysical(0x002000)).toBe(0x002000);
  });
});

describe('DM32UVSession.readCodeplugImage', () => {
  it('assembles pages at their virtual offsets', async () => {
    const s = session(new FakeRadio());
    await s.connect();
    const { image, map } = await s.readCodeplugImage();

    expect(map.size).toBe(3);
    // Virtual pages 1..3 are mapped, so the image spans 0x0000-0x3fff and its
    // first page stays unmapped by protocol design.
    expect(image.length).toBe(0x4000);
  });

  it('places a scattered physical page at its virtual offset', async () => {
    // Physical page 0 declares itself virtual page 3, so its filler bytes must
    // land at 0x3000 in the assembled image.
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0x03],
        [0x001000, 0x01],
        [0x002000, 0x02],
      ]),
    });
    const s = session(radio);
    await s.connect();
    const { image } = await s.readCodeplugImage();

    // Filler for physical page 0 at offset 0x10 is (0 >>> 12) ^ 0x10 = 0x10.
    expect(image[0x3010]).toBe(0x10);
    // Physical page 1 -> virtual 1; filler is (0x1000 >>> 12) ^ 0x10 = 0x11.
    expect(image[0x1010]).toBe(0x11);
  });

  it('refuses to assemble an image containing holes', async () => {
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0x01],
        [0x001000, 0xff], // leaves a hole at virtual page 2
        [0x002000, 0x03],
      ]),
    });
    const s = session(radio);
    await s.connect();
    await expect(s.readCodeplugImage()).rejects.toThrow(/missing from the address map/i);
  });

  it('fails clearly when no pages map at all', async () => {
    const radio = new FakeRadio({
      pageLayout: new Map([
        [0x000000, 0xff],
        [0x001000, 0xff],
        [0x002000, 0xff],
      ]),
    });
    const s = session(radio);
    await s.connect();
    await expect(s.readCodeplugImage()).rejects.toThrow(/No codeplug pages were mapped/i);
  });
});

describe('DM32UVSession.close', () => {
  it('cycles DTR low so the radio leaves program mode', async () => {
    const radio = new FakeRadio();
    const s = session(radio);
    await s.connect();
    await s.enterProgramMode();
    await s.close();

    expect(radio.signalHistory.at(-1)).toEqual({ dtr: false });
    expect(radio.closed).toBe(true);
    expect(s.currentState).toBe('closed');
  });

  it('is a no-op when never opened', async () => {
    const radio = new FakeRadio();
    await session(radio).close();
    expect(radio.closed).toBe(false);
  });
});

describe('explainFailure', () => {
  it('returns the preflight checklist for a detection failure', () => {
    const advice = explainFailure(new Error('Radio did not respond to detection after 3 attempts'));
    expect(advice.join(' ')).toMatch(/analog channel/i);
    expect(advice.join(' ')).toMatch(/charger/i);
  });

  it('warns against writing when the stream desynchronizes', () => {
    const advice = explainFailure(new Error('the stream is out of sync'));
    expect(advice.join(' ')).toMatch(/Do not attempt to write/i);
  });

  it('handles a non-Error value', () => {
    expect(explainFailure('boom').join(' ')).toMatch(/boom/);
  });
});
