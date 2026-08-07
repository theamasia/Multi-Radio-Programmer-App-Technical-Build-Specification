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

```bash
npm install     # rebuilds native modules against Electron's ABI
npm run dev     # Vite renderer + main-process watch
npm run typecheck && npm run lint && npm test
npm run package # Windows NSIS installer
```

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
