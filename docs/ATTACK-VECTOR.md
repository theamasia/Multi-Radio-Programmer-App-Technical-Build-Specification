# Attack Vector — Multi-Radio Programmer App

Derived from `docs/TECHNICAL-BUILD-SPEC.md`. This document is the execution
strategy: sequencing, risk register, and de-risking decisions. The spec says
*what* to build; this says *how we attack it and in what order*.

## Core Strategy: Two Independent Tracks

The spec's build order is mostly linear, which is a mistake — it puts the
highest-risk item (DM-32UV DMR reverse engineering) on the critical path to a
shippable app. Split into two tracks that never block each other:

- **Track A (Certain / Value Path)** — Analog radios + offline frequency DB.
  Every component has known prior art. Ships a genuinely useful app on its own.
- **Track B (Uncertain / Research Path)** — DM-32UV DMR codeplug protocol.
  Open-ended reverse engineering. Time-boxed, behind a feature flag, never
  gates a release.

Track A must produce a working end-to-end vertical slice before Track B starts
consuming meaningful effort.

## Phase Plan

### Phase 0 — Foundation (Track A)
Repo scaffold, TypeScript strict, Electron main/preload/renderer split with
`contextIsolation: true` and `nodeIntegration: false`, ESLint + Vitest, GitHub
Actions CI (typecheck → lint → test → build), `electron-builder` NSIS target.

Deliberate choice: **all serial I/O lives in the main process**, exposed to the
renderer only through narrow, validated IPC channels. The renderer never gets
Node access. This is the single most important architectural constraint —
retrofitting it later is expensive.

Exit criteria: `npm run build` produces an installable Windows artifact from CI.

### Phase 1 — Vertical Slice: One Radio, End to End (Track A)
Do **not** build the layers horizontally. Build one narrow path all the way
through: port enumeration → chipset detection → UV-5R handshake → read
codeplug → render channel grid → write codeplug back → verify by re-read.

Scope: `SerialManager`, `portDetection`, `IRadioDriver`, one ported CHIRP
analog driver (UV-5R family), minimal `ChannelEditor.tsx`.

Exit criteria: real radio round-trips a codeplug without corruption. This is
the moment the project stops being theoretical.

### Phase 2 — Driver Breadth (Track A)
With the interface proven against real hardware, port additional CHIRP analog
drivers. Each new radio is now a contained, low-risk unit of work. Add the
`gmrs-generic` driver with the bundled fixed 30-channel table and the
Part 95E transmit-license warnings in the UI.

### Phase 3 — Offline Frequency Database (Track A)
`better-sqlite3` schema, migrations, `SqliteClient`, seeded GMRS channels, ZIP→
county resolver, `FrequencyBrowser.tsx` reading **local DB only**. No network
code in this phase at all — proves the offline-first contract by construction.

### Phase 4 — Sync Layer (Track A)
`RepeaterBookSync` + `SyncScheduler` bolted onto the already-working local read
path. Idempotent upserts keyed by record ID. Sync failure must be a non-event
for the UI.

### Phase 5 — Windows Driver Install (Track A)
`DriverInstallManager`, chipset catalog, bundled vendor installers, elevation
via UAC, `DriverHelp.tsx` fallback. Sequenced late on purpose: during dev you
already have working drivers, so this is polish for end users, not a blocker.

### Phase 6 — DM-32UV (Track B, parallel from Phase 2 onward)
Protocol capture and mapping, documented incrementally in
`docs/protocol-notes/dm32uv-protocol.md`. Ships when it ships.

## Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **CHIRP is GPL-3.0.** Porting its driver logic to TypeScript creates a derivative work, obligating this app to ship under GPL-3.0 with source. | Blocking | Adopt GPL-3.0 for the whole repo from commit one. Cheap here — the repo is already public. The alternative (clean-room reimplementation from protocol docs only) costs months. Decide before any driver code is written; retrofitting a license across contributors is painful. |
| 2 | **DM-32UV protocol is unmapped** and may resist reverse engineering. Spec treats it as a build step; it is a research project. | High | Isolate to Track B behind a feature flag. Survey prior art first (see below) before spending a single hour on Portmon capture. Time-box the survey to days, not weeks. |
| 3 | **`better-sqlite3` is a native module** and must be rebuilt against Electron's ABI, not Node's. Classic `NODE_MODULE_VERSION` mismatch. | Medium | Wire `electron-builder install-app-deps` into `postinstall` in Phase 0, before any DB code exists. Pin Electron and better-sqlite3 versions together; CI builds catch drift. |
| 4 | **RepeaterBook API is now key-gated** (`x-api-key` / `RBApp-Token`) and licensed for personal use only; commercial keys are a separate track. | Medium | Obtain the key before Phase 4 starts. Architecture already tolerates its absence — Phase 3 ships useful without it. Do not redistribute cached RepeaterBook data in the installer. |
| 5 | **Bundling vendor USB drivers** (CH341SER, CP210x, PL2303) carries redistribution-license questions and bloats the installer. | Medium | Default to *detect and link* rather than *bundle and install*. Bundle only where the vendor license clearly permits redistribution. `DriverHelp.tsx` becomes the primary path, not the fallback. |
| 6 | **Writing a bad codeplug can brick a radio.** | High | Mandatory read-before-write. Auto-snapshot the factory codeplug on first connect and store it immutably. Checksum validation on every write. Re-read and diff to verify. Never write a codeplug the app cannot first parse. |
| 7 | Repo name describes a *specification*, not an application. | Low | Rename to `multi-radio-programmer` once building starts; keep the spec under `docs/`. |

## Prior Art to Exploit Before Building

Reusing existing work is the highest-leverage move available. Survey these
before writing driver code:

- **CHIRP** — [kk7ds/chirp](https://github.com/kk7ds/chirp). The analog driver
  corpus. Track A's driver work is largely translation, not invention.
- **NeonPlug** — a browser-based open-source CPS specifically for the
  DM-32UV, discussed on
  [r/Baofeng](https://www.reddit.com/r/Baofeng/comments/1pmwp2x/dm32_open_source_cps_neonplugapp/).
  If its codeplug mapping is published, this collapses Track B from months of
  reverse engineering into a port. **Highest-value item in this document.**
- **qdmr / libdmrconf** — [hmatuschek/qdmr](https://github.com/hmatuschek/qdmr).
  Mature C++ DMR codeplug library. DM-32UV is *not* in its
  [supported-radio list](https://dm3mat.de/software/qdmr), but its
  [device modules](https://dm3mat.darc.de/qdmr/libdmrconf/modules.html) are the
  best available reference for how HR-C6000-class codeplugs are structured.
- **DM-32UV CPS archive** — [M7OCM/DM-32UV](https://github.com/M7OCM/DM-32UV).
  Official CPS/firmware binaries for capture and diffing.
- **Practical connection quirks** — the DM-32UV reportedly needs 115200 baud,
  VFO on an analog channel, and no USB charging attached, per
  [WE8CHZ](https://www.we8chz.org/?p=966). Encode these as preflight checks and
  actionable error messages rather than letting users hit opaque failures.
- **hamkit-repeaterbook** / **hamkit-uls** — reference implementations for
  local caching and ULS parsing.

## Non-Negotiable Engineering Rules

1. Renderer never touches Node or serial directly. IPC only, inputs validated.
2. No network call is ever on a UI read path. UI reads SQLite; sync writes SQLite.
3. Every codeplug write is preceded by a successful read and followed by a
   verifying re-read.
4. Factory codeplug is snapshotted before the first user write and never
   overwritten.
5. Each radio driver ships with fixture-based tests using captured codeplug
   binaries, so drivers are testable without hardware in CI.
6. Frequency data is cached, never redistributed.
