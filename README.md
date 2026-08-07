# Multi-Radio Programmer App

Windows desktop application for programming multiple two-way radios
(Baofeng DM-32UV, GMRS radios, non-DMR ham radios) over USB, with an
offline-first frequency database searchable by ZIP code.

## Status

**Phase 0 complete.** Scaffold builds and passes CI (typecheck, lint, tests).
Next up is Phase 1: porting the DM-32UV serial transport, read-only.

## Documents

- [Attack Vector](docs/ATTACK-VECTOR.md) — execution strategy, phase sequencing,
  and risk register. **Start here.**
- [DM-32UV Protocol Notes](docs/protocol-notes/dm32uv-protocol.md) — prior-art
  survey establishing that the protocol is already publicly mapped.
- [Technical Build Specification](docs/TECHNICAL-BUILD-SPEC.md) — original
  architecture and module boundaries.

## Development

**Windows x64 is the only supported runtime and the only valid test target.**
Linux and macOS machines are usable for writing code and running the unit tests,
which work against fixtures and never touch hardware, but a build is not
considered verified until it has run on native Windows with a real radio.

```powershell
npm install       # rebuilds native modules against Electron's ABI
npm start         # build, then launch the app
npm run dev       # Vite + main watch + Electron, with reload
npm run dump      # read-only codeplug dump (no GUI needed)
npm run typecheck && npm run lint && npm test
npm run package   # Windows NSIS installer
```

`npm run dev` waits for the Vite server and the compiled main/preload bundles
before attaching Electron. Without that wait Electron opens a blank window and
does not retry, which looks like a build failure but is only a race.

## Licensing and Attribution

GPL-3.0-or-later. This is a deliberate choice, not an incidental one: it permits
porting driver logic from [CHIRP](https://github.com/kk7ds/chirp) and from
[qdmr](https://github.com/hmatuschek/qdmr), both copyleft, whose prior work
makes this project tractable. Ported code carries attribution to its upstream
source.

## Planned Stack

Electron · TypeScript (strict) · React 18 · node-serialport · better-sqlite3 ·
Vitest · electron-builder (NSIS)

## Safety Notice

This software writes codeplugs to radio hardware. A malformed write can render a
radio inoperable. The application always reads and snapshots the existing
codeplug before writing, and verifies every write with a re-read.

Transmitting on amateur and GMRS frequencies requires the appropriate FCC
license. This tool does not grant transmit privileges.
