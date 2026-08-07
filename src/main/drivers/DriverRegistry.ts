import type { IRadioDriver, SerialTransport } from './IRadioDriver.js';

/**
 * Holds the set of available radio drivers and resolves which one is attached.
 *
 * Detection is explicit and sequential rather than parallel: probing a radio
 * with the wrong handshake can leave it in an odd state, so we try one at a
 * time and flush between attempts.
 */
export class DriverRegistry {
  private readonly drivers = new Map<string, IRadioDriver>();

  register(driver: IRadioDriver): void {
    if (this.drivers.has(driver.modelId)) {
      throw new Error(`Driver already registered for model "${driver.modelId}"`);
    }
    this.drivers.set(driver.modelId, driver);
  }

  get(modelId: string): IRadioDriver {
    const driver = this.drivers.get(modelId);
    if (!driver) throw new Error(`No driver registered for model "${modelId}"`);
    return driver;
  }

  list(): readonly IRadioDriver[] {
    return [...this.drivers.values()];
  }

  /**
   * Tries each driver's handshake in turn. Returns the first match, or null.
   *
   * A driver that throws during detection is treated as a non-match, not a
   * fatal error -- an unrelated radio on the port is an expected condition.
   */
  async detect(transport: SerialTransport): Promise<IRadioDriver | null> {
    for (const driver of this.drivers.values()) {
      try {
        await transport.flush();
        if (await driver.detect(transport)) return driver;
      } catch {
        // Not this model. Continue probing.
      }
    }
    return null;
  }
}
