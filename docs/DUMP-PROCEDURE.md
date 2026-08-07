# Dumping your DM-32UV codeplug

This is the Phase 1 exit criterion. Everything in the driver so far is verified
against an emulator, which proves the code is internally consistent but cannot
prove the port matches your radio. This procedure produces that proof, plus the
fixture every later phase is developed against.

**This operation is read-only.** The dump tool imports no write path. The
protocol's write command is implemented and tested but nothing calls it, by
design, until Phase 3.

## Before you start

Run this on Windows, where the Prolific driver lives. Node 20 or newer.

```powershell
git clone https://github.com/theamasia/Multi-Radio-Programmer-App-Technical-Build-Specification.git
cd Multi-Radio-Programmer-App-Technical-Build-Specification
npm install
```

If `npm install` fails building `better-sqlite3`, install with
`npm install --ignore-scripts`. The dump tool does not need it: `better-sqlite3`
is imported only by `src/main/db/schema.ts`, which the Electron main process
loads and this tool never touches.

`serialport` needs no rebuild at all. It ships N-API prebuilds
(`node.napi.node`), and N-API is ABI-stable across Node and Electron versions, so
the same binary works under both. This matters because `postinstall` runs
`electron-builder install-app-deps`, which rebuilds native modules against
Electron's ABI (125) rather than Node 20's (115) — that affects `better-sqlite3`
but not the serial layer this tool depends on.

## Preflight

Every item here has been observed to cause the exact same symptom: an opaque
serial timeout. Work through them rather than debugging.

- [ ] **Set VFO A to an analog channel or frequency, not a DMR one.** The radio
      refuses to enter program mode from a digital channel.
- [ ] **Set the volume to roughly 50%.** These cables tap the speaker/mic lines,
      so signalling levels depend on the volume knob position.
- [ ] **Unplug the radio from any charger or USB power.** Charging injects RF
      interference that corrupts the link mid-transfer.
- [ ] **Seat the cable firmly** until the Kenwood-style plug bottoms out. A
      partly seated plug connects audio but not data, so the COM port appears
      and then times out.
- [ ] **Power the radio on before connecting.** The cable enumerates a COM port
      with the radio off, which is misleading.

Source for the analog-VFO and charging quirks:
[WE8CHZ on DM-32 programming](https://www.we8chz.org/?p=966).

## Confirm the cable is visible

```powershell
npm run dump -- --list
```

You want a port reporting **USB 067b:23a3** (Prolific PL2303). If nothing
appears, the driver is missing or the cable is a counterfeit PL2303 that recent
Windows drivers deliberately reject — the usual fix is Prolific's older
3.3.11.152 driver.

## Dump

```powershell
npm run dump
```

Add `-- --port COM5` if auto-detection picks the wrong port.

Expect it to identify the radio as model `DP570UV`, print your firmware version,
enter program mode, then read for a couple of minutes. It writes two files into
`test/fixtures/`:

- `dm32uv-codeplug-<timestamp>.bin` — the assembled image
- `dm32uv-codeplug-<timestamp>.map.json` — the discovered page map

## Judging the result

The tool prints a sanity check. What you want to see:

- **Model reported as `DP570UV`.** Anything else and the tool aborts, correctly.
- **A codeplug memory range** reported from the radio itself, not hardcoded.
- **A page count with no gaps** in the map JSON.
- **The image is not entirely 0x00/0xff.** If it is, the read succeeded
  mechanically but returned nothing real — treat the dump as invalid.

Two outcomes are informative even though they look like failure:

- **Unknown firmware warning.** The dump is still safe. It means your firmware
  was not among those seen during porting, so the memory layout is unverified.
  Report the version.
- **Gaps in the address map.** The tool refuses to assemble an image with holes
  rather than silently zero-filling. That refusal is the feature; report the map.

## Afterwards

The radio has no exit-program-mode command. The tool drops DTR and waits, which
resets it. If the display still looks stuck, power cycle it — this is normal and
not a sign of damage.

Commit the fixture:

```powershell
git add test/fixtures/
git commit -m "Add real DM-32UV codeplug fixture from <firmware version>"
git push
```

Then report the firmware version, the page count, and whether the sanity check
passed. Phase 2 builds codeplug parsing against this fixture and must prove a
byte-identical round-trip — parse then re-serialize to the same bytes — before
Phase 3 is allowed to write anything to a radio.

## If it fails

The tool prints guidance matched to the specific failure. The general rule:
a failure during detection is almost always preflight, and a failure partway
through a read is almost always power or cable. Nothing in this procedure can
damage the radio, since no write path is reachable.
