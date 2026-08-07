import { describe, expect, it, vi } from 'vitest';
import { DriverRegistry } from '../src/main/drivers/DriverRegistry.js';
import type { IRadioDriver, SerialTransport } from '../src/main/drivers/IRadioDriver.js';

function stubTransport(): SerialTransport {
  return {
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    read: vi.fn(async () => new Uint8Array()),
    flush: vi.fn(async () => undefined),
  };
}

function stubDriver(modelId: string, detects: boolean | Error): IRadioDriver {
  return {
    modelId,
    displayName: modelId,
    serialOptions: { baudRate: 9600 },
    detect: async () => {
      if (detects instanceof Error) throw detects;
      return detects;
    },
    getFeatures: () => {
      throw new Error('not implemented in stub');
    },
    readCodeplug: () => {
      throw new Error('not implemented in stub');
    },
    writeCodeplug: () => {
      throw new Error('not implemented in stub');
    },
    parseImage: () => {
      throw new Error('not implemented in stub');
    },
    validateChannel: () => [],
  };
}

describe('DriverRegistry', () => {
  it('rejects duplicate model registrations', () => {
    const registry = new DriverRegistry();
    registry.register(stubDriver('uv-5r', true));
    expect(() => registry.register(stubDriver('uv-5r', true))).toThrow(/already registered/);
  });

  it('throws a clear error for an unknown model', () => {
    expect(() => new DriverRegistry().get('nope')).toThrow(/No driver registered/);
  });

  it('returns the first driver whose handshake succeeds', async () => {
    const registry = new DriverRegistry();
    registry.register(stubDriver('no-match', false));
    registry.register(stubDriver('match', true));
    const found = await registry.detect(stubTransport());
    expect(found?.modelId).toBe('match');
  });

  it('treats a throwing probe as a non-match and keeps going', async () => {
    const registry = new DriverRegistry();
    registry.register(stubDriver('explodes', new Error('bad handshake')));
    registry.register(stubDriver('match', true));
    const found = await registry.detect(stubTransport());
    expect(found?.modelId).toBe('match');
  });

  it('flushes the transport before each probe', async () => {
    const registry = new DriverRegistry();
    registry.register(stubDriver('a', false));
    registry.register(stubDriver('b', false));
    const transport = stubTransport();
    await registry.detect(transport);
    expect(transport.flush).toHaveBeenCalledTimes(2);
  });

  it('returns null when nothing matches', async () => {
    const registry = new DriverRegistry();
    registry.register(stubDriver('a', false));
    expect(await registry.detect(stubTransport())).toBeNull();
  });
});
