# Attack Vector — Multi-Radio Programmer App

> **Revised after the DM-32UV prior-art survey.** The original plan treated the
> DM-32UV DMR protocol as open-ended reverse engineering on a separate research
> track. That premise was wrong: **qdmr ships complete, working, GPL-3.0
> DM-32UV support**, and this project is GPL-3.0, so the protocol is a *port*,
> not a research problem. The phase order below reflects that. See
> [dm32uv-protocol.md](protocol-notes/dm32uv-protocol.md) for the evidence.

Derived from `docs/TECHNICAL-BUILD-SPEC.md`. This document is the execution
strategy: sequencing, risk register, and de-risking decisions. The spec says
*what* to build; this says *how we attack it and in what order*.

## Core Strategy

The original two-track split (certain analog work vs. uncertain DMR research)
existed only to keep DM-32UV reverse engineering off the critical path. That
justification is gone. Three independent open-source projects have already
mapped the protocol, and the most complete one is license-compatible:

- **[qdmr](https://github.com/hmatuschek/qdmr)** — GPL-3.0, 343 stars. Ships
  `lib/dm32uv_interface.{cc,hh}` (serial transport) and
  `lib/dm32uv_codeplug.{cc,hh}` (byte-level structures) as merged, working code.
  GPL-3.0 → GPL-3.0 means this can be a close line-by-line port.
- **[DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec)** — prose
  protocol spec (connection sequence, command frames, memory layout, data
  structures) that qdmr's own maintainer used as reference.
- **[NeonPlug](https://github.com/infamy/NeonPlug)** — an actively developed
  TypeScript/Web Serial CPS for this exact radio. The closest thing to "what
  our driver should look like," *but its license is asserted only in prose with
  no LICENSE file* — read for structure, do not copy until that is fixed.

So the strategy inverts: **target the DM-32UV first**, because it is the radio
you physically have, the protocol is documented, and the reference
implementation is portable. Analog/CHIRP drivers become the follow-on breadth
work rather than the proving ground.

The one hard constraint carried over: the protocol has an **unresolved address
byte-order discrepancy** between two sources (little-endian per the spec/qdmr
headers, big-endian per dmrconfig_dm32's worked examples). **This has since been
resolved as little-endian** by reading qdmr's byte-packing code directly; see
risk 8. Getting it wrong
corrupts every transfer. Therefore every phase below is **read-only until the
byte order is empirically confirmed**.

## Phase Plan

### Phase 0 — Foundation ✅ complete
Electron + TypeScript (strict) + React scaffold, GPL-3.0, Windows CI running
typecheck → lint → test → build. All serial and database access confined to the
main process, enforced by an ESLint rule that fails the build if the renderer
imports `serialport`, `better-sqlite3`, `electron`, or `node:fs`.
`IRadioDriver` and `SerialTransport` contracts defined so drivers are testable
against recorded byte streams with no hardware attached.

### Phase 1 — Port the DM-32UV transport, read-only
Translate qdmr's `dm32uv_interface.cc` and the `c7000device` base class into
TypeScript: handshake, V-frame metadata queries, program-mode entry, and the
read frame. Replicate qdmr's **dynamic address discovery** — read the V-frame
pointer tuples at connect time rather than hardcoding offsets, because the
memory map differs across firmware variants.

Preflight checks belong here, as first-class validated conditions with
actionable messages rather than mystery timeouts: 115200 baud, VFO on an analog
channel, radio not charging over USB, volume near 50%.

**Exit criteria:** dump a full codeplug image from your radio and save it as a
test fixture. This single artifact settles the byte-order question empirically
and unblocks everything downstream.

### Phase 2 — Codeplug parsing against fixtures
Port `dm32uv_codeplug.cc` structures (48-byte channel records, zones, contacts,
RX groups, radio IDs, settings) into TypeScript decoders. All work is now
offline against the Phase 1 fixture, so it is fast, deterministic, and fully
CI-testable without hardware.

**Exit criteria:** parse the fixture and round-trip it back to a byte-identical
image. Byte-identical re-serialization is the proof that the parse is complete
and that unmapped regions survive untouched.

### Phase 3 — First write, with maximum paranoia
Only now enable writing. Order of operations: snapshot factory codeplug
immutably → patch the raw image rather than regenerating it → write → re-read →
diff. Refuse to write any image the parser cannot first read back.

Instrument the `0x06` / `0xC0` / `0xC8` / `0x48` response bytes with defensive
logging: their meanings are documented as *unverified guesses* upstream, so
confirming them empirically is a deliverable of this phase.

**Exit criteria:** a channel edit appears on the radio's display and survives a
power cycle.

### Phase 4 — Offline frequency database
`better-sqlite3` schema, migrations, seeded fixed GMRS channel table, ZIP→county
resolver, `FrequencyBrowser.tsx` reading **local SQLite only**. No network code
in this phase at all, which proves the offline-first contract by construction.

### Phase 5 — Sync layer
`RepeaterBookSync` + `SyncScheduler` bolted onto the already-working local read
path. Idempotent upserts keyed by record ID. A sync failure must be a non-event
for the UI.

### Phase 6 — Analog driver breadth
Now port CHIRP's analog drivers (UV-5R family, GMRS-generic). With the interface
already proven against real hardware, each additional radio is a contained,
low-risk unit of work. GMRS ships with the fixed 30-channel table and Part 95E
transmit-license warnings.

### Phase 7 — Windows driver install and packaging
`DriverInstallManager`, chipset detection, `DriverHelp.tsx`, signed NSIS
installer. Sequenced last on purpose: your dev machine already has working
drivers, so this is end-user polish, not a blocker.

## Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **CHIRP is GPL-3.0.** Porting its driver logic to TypeScript creates a derivative work, obligating this app to ship under GPL-3.0 with source. | Blocking | Adopt GPL-3.0 for the whole repo from commit one. Cheap here — the repo is already public. The alternative (clean-room reimplementation from protocol docs only) costs months. Decide before any driver code is written; retrofitting a license across contributors is painful. |
| 2 | ~~DM-32UV protocol is unmapped.~~ **Retired.** The survey found qdmr's merged GPL-3.0 implementation plus two corroborating specs. | Retired | No longer a risk. Replaced by risk 8 below. |
| 3 | **`better-sqlite3` is a native module** and must be rebuilt against Electron's ABI, not Node's. Classic `NODE_MODULE_VERSION` mismatch. | Medium | Wire `electron-builder install-app-deps` into `postinstall` in Phase 0, before any DB code exists. Pin Electron and better-sqlite3 versions together; CI builds catch drift. |
| 4 | **RepeaterBook API is now key-gated** (`x-api-key` / `RBApp-Token`) and licensed for personal use only; commercial keys are a separate track. | Medium | Obtain the key before Phase 4 starts. Architecture already tolerates its absence — Phase 3 ships useful without it. Do not redistribute cached RepeaterBook data in the installer. |
| 5 | **Bundling vendor USB drivers** (CH341SER, CP210x, PL2303) carries redistribution-license questions and bloats the installer. | Medium | Default to *detect and link* rather than *bundle and install*. Bundle only where the vendor license clearly permits redistribution. `DriverHelp.tsx` becomes the primary path, not the fallback. |
| 6 | **Writing a bad codeplug can brick a radio.** | High | Mandatory read-before-write. Auto-snapshot the factory codeplug on first connect and store it immutably. Checksum validation on every write. Re-read and diff to verify. Never write a codeplug the app cannot first parse. |
| 7 | Repo name describes a *specification*, not an application. | Low | Rename to `multi-radio-programmer`; keep the spec under `docs/`. `package.json` already uses the app name. |
| 8 | ~~Address byte order is contested~~ — **RESOLVED (little-endian)**. Verified directly in qdmr `lib/dm32uv_interface.cc`, which packs `address[0] = (addr >> 0) & 0xff; address[1] = (addr >> 8) & 0xff; address[2] = (addr >> 16) & 0xff;` — least significant byte first. dmrconfig_dm32's big-endian hex examples were misread. | Closed | Locked in by `encodeAddress24` and asserted in `test/dm32uv-frames.test.ts`. Still requires confirmation against a real dump before any write is attempted. |
| 9 | **NeonPlug asserts MIT in prose but ships no LICENSE file**, so incorporating its code into a GPL-3.0 project rests on a weak grant. | Medium | Use qdmr (explicit, file-backed GPL-3.0) as the porting source. Treat NeonPlug as a read-only structural reference and ask the author to add a LICENSE file. |
| 10 | **31 flash pages and 32 logical block IDs have unknown purpose** — never touched by the OEM CPS in captured sessions. | Medium | Mark as "unknown, do not touch." The raw-image patching model already preserves them untouched by default. |

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


---

## Phase 1 completion record

Phase 1 delivered the DM-32UV serial transport as a read-only TypeScript port
of qdmr's `dm32uv_interface.cc` / `c7000device.cc`.

**Shipped**

| File | Role |
|---|---|
| `src/main/drivers/baofeng-dm32uv/constants.ts` | Protocol constants, timings, value IDs, page sentinels |
| `src/main/drivers/baofeng-dm32uv/frames.ts` | Pure frame codec and page-boundary transfer planner |
| `src/main/drivers/baofeng-dm32uv/AddressMap.ts` | Bidirectional physical/virtual page translation |
| `src/main/drivers/baofeng-dm32uv/session.ts` | Handshake, program mode, address discovery, image read |
| `src/main/drivers/baofeng-dm32uv/preflight.ts` | Preconditions and failure-specific guidance |
| `scripts/dump-dm32uv.ts` | Standalone read-only dump tool (`npm run dump`) |
| `test/helpers/FakeRadio.ts` | In-memory radio emulator implementing `SerialTransport` |
| `test/dm32uv-{frames,addressmap,session}.test.ts` | 51 new tests, no hardware required |

Also added `setSignals` to the `SerialTransport` interface, since the radio has
no exit-program-mode command and must be reset by cycling DTR.

**Verification:** typecheck, lint (`--max-warnings 0`), 64 tests, and the full
production build all pass.

**New finding — virtual page 0 is unrepresentable.** Each 4 KiB page stores its
virtual index in its own final byte, and qdmr treats both `0x00` and `0xff` as
"unallocated" sentinels. A page legitimately holding virtual index 0 is
therefore indistinguishable from an empty one, so the codeplug's virtual address
space effectively begins at `0x1000` and bytes `0x0000-0x0fff` of any assembled
image are always unmapped. This is documented in `constants.ts` and asserted by
test. It matters for Phase 2: parsers must not assume offset 0 of the image is
meaningful codeplug data.

**Phase 1 exit criterion is met.** The protocol has run against real hardware:
`test/fixtures/dp570uv-factory-codeplug.bin` is a full 512,000-byte codeplug
read from the physical radio over the cable, with its address map alongside it.

The emulator work that preceded it could only ever confirm internal
consistency, never that the port matched the radio. Two things it could not
have caught turned up immediately on real hardware: the cable is a WCH CH340,
not the Prolific PL2303 the docs assumed, and the radio allocates codeplug
pages sparsely, so 17 of 200 pages are simply absent rather than the read
having failed. Both were fixed before the dump succeeded.
