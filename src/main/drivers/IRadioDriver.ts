import type { Codeplug } from '../../shared/types/Codeplug.js';
import type { Channel } from '../../shared/types/Channel.js';

/**
 * Transport abstraction over a serial port.
 *
 * Drivers depend on this rather than on `serialport` directly, so every driver
 * is testable in CI against a recorded byte stream with no hardware attached.
 */
export interface SerialTransport {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  /** Reads exactly `length` bytes or rejects on timeout. */
  read(length: number, timeoutMs: number): Promise<Uint8Array>;
  /** Discards any buffered inbound bytes. Call before a handshake. */
  flush(): Promise<void>;
}

export interface SerialOptions {
  readonly baudRate: number;
  readonly dataBits?: 7 | 8;
  readonly stopBits?: 1 | 2;
  readonly parity?: 'none' | 'even' | 'odd';
}

/** Capability declaration. The UI uses this to enable or hide controls. */
export interface RadioFeatures {
  readonly channelCount: number;
  readonly zoneCount: number;
  readonly channelsPerZone: number;
  readonly supportsDmr: boolean;
  readonly supportsZones: boolean;
  readonly contactCount: number;
  /** Inclusive transmit frequency ranges in Hz. */
  readonly txBandsHz: readonly { readonly startHz: number; readonly endHz: number }[];
  readonly maxChannelNameLength: number;
}

export interface ProgressReport {
  readonly phase: 'handshake' | 'reading' | 'writing' | 'verifying';
  readonly bytesDone: number;
  readonly bytesTotal: number;
}

export type ProgressCallback = (report: ProgressReport) => void;

/**
 * Contract every supported radio implements.
 *
 * Implementations must obey three rules:
 *  1. `writeCodeplug` patches `codeplug.rawImage` rather than synthesizing a
 *     fresh image, so unmapped memory regions are preserved verbatim.
 *  2. `writeCodeplug` must reject rather than write when validation fails.
 *  3. Nothing is written before a successful read of the same radio.
 */
export interface IRadioDriver {
  readonly modelId: string;
  readonly displayName: string;
  /** Serial parameters this radio's bootloader/CPS protocol requires. */
  readonly serialOptions: SerialOptions;

  /** Probes for this specific model. Must leave the port usable on failure. */
  detect(transport: SerialTransport): Promise<boolean>;

  getFeatures(): RadioFeatures;

  readCodeplug(
    transport: SerialTransport,
    onProgress?: ProgressCallback,
  ): Promise<Codeplug>;

  writeCodeplug(
    transport: SerialTransport,
    codeplug: Codeplug,
    onProgress?: ProgressCallback,
  ): Promise<void>;

  /** Parses a raw image without hardware. Used for fixture-based tests. */
  parseImage(rawImage: Uint8Array): Codeplug;

  /**
   * Rejects channels this radio cannot represent -- out-of-band transmit,
   * unsupported mode, name too long. Called before every write.
   */
  validateChannel(channel: Channel): readonly string[];
}
