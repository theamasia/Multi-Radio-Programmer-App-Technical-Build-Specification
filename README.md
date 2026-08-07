# Multi-Radio Programmer App

Windows desktop application for programming multiple two-way radios
(Baofeng DM-32UV, GMRS radios, non-DMR ham radios) over USB, with an
offline-first frequency database searchable by ZIP code.

## Status

Pre-implementation. The specification and execution plan are committed; code
scaffolding has not begun.

## Documents

- [Technical Build Specification](docs/TECHNICAL-BUILD-SPEC.md) — architecture,
  module boundaries, file structure, and external references.
- [Attack Vector](docs/ATTACK-VECTOR.md) — execution strategy, phase sequencing,
  risk register, and prior art to exploit.

## Planned Stack

Electron · TypeScript (strict) · React 18 · node-serialport · better-sqlite3 ·
Vitest · electron-builder (NSIS)

## Safety Notice

This software writes codeplugs to radio hardware. A malformed write can render a
radio inoperable. The application always reads and snapshots the existing
codeplug before writing, and verifies every write with a re-read.

Transmitting on amateur and GMRS frequencies requires the appropriate FCC
license. This tool does not grant transmit privileges.
