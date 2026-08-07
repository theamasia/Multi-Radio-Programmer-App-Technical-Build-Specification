# Baofeng DM-32UV — Prior Art Survey (Codeplug Format & Serial Protocol)

Research date: August 7, 2026. Compiled to determine whether a GPL-3.0 TypeScript driver for the DM-32UV can port existing open-source work instead of reverse-engineering the radio from scratch.

## Summary and Bottom Line

**A port is viable, and most of the hard reverse-engineering has already been done by others and published under open licenses.** Three independent, mutually-corroborating open-source efforts now cover the DM-32UV serial transport and a large fraction of its codeplug structure:

1. **[hmatuschek/qdmr](https://github.com/hmatuschek/qdmr)** (GPL-3.0) merged full, working DM-32UV support into `master` in release **v0.14.0** ([qdmr issue #577](https://github.com/hmatuschek/qdmr/issues/577), [qdmr supported-radio list at dm3mat.de](https://dm3mat.de/software/qdmr)). Its `lib/dm32uv_interface.{cc,hh}` and `lib/dm32uv_codeplug.{cc,hh}` files are a complete, compilable C++ implementation of the transport (handshake, `V`/`R`/`W` frames, program-mode entry) and a large, byte-and-bit-level annotated codeplug structure (channels, zones, contacts, radio IDs, talk groups, GPS/APRS settings, encryption keys, etc.), confirmed directly from the raw header source at [raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_codeplug.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_codeplug.hh) and [.../lib/dm32uv_interface.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_interface.hh). **Because qdmr is GPL-3.0 and the target driver is GPL-3.0, this code can be ported/translated directly (structure, field offsets, and protocol logic) without a licensing conflict.**
2. **[infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec)** (MIT license) is a dedicated, standalone protocol specification document with concrete opcodes, timing, and address-space documentation, explicitly cross-checked against the CPS binary and against qdmr's implementation ([referenced directly from qdmr's own interface header](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_interface.hh)). It is honest about what remains unconfirmed (31 unread flash pages, 32 unidentified logical block IDs, no confirmed checksum scheme).
3. **[emuehlstein/dmrconfig_dm32](https://github.com/emuehlstein/dmrconfig_dm32)** (BSD-3-Clause), an earlier fork of `dmrconfig` for the DM-32, whose author explicitly deferred to and was superseded by the `infamy/DM32-Protocol-Spec` analysis, but which independently corroborates the transport-level details (handshake tokens, `0x52`/`0x57` read/write frames, V-frame catalog) and adds channel/zone/contact record decoding with worked hex examples.
4. **NeonPlug** ([github.com/infamy/NeonPlug](https://github.com/infamy/NeonPlug), MIT license) is the actual working browser-based CPS (not merely announced — a real, active TypeScript/Web Serial repository with 29 stars). It is written by the same author as the DM32-Protocol-Spec repository ("infamy" / Alex Harvey, aka Reddit user `meshmeld`, per the [announcement thread](https://www.reddit.com/r/Baofeng/comments/1pmwp2x/dm32_open_source_cps_neonplugapp/)) and has a dedicated `src/radios/dm32uv/` module (`protocol.ts`, `structures.ts`, `memory.ts`, `blockLayouts.ts`, `connection.ts`, `constants.ts`) confirmed via the [GitHub repository tree API](https://github.com/infamy/NeonPlug). This is a second, TypeScript-native, MIT-licensed implementation of the exact same protocol — directly relevant as a structural/API reference for a TypeScript port, separate from the GPL-3.0 qdmr codebase.

Between these four sources, the serial transport (handshake, read/write opcodes, block size, addressing) is **fully mapped and independently corroborated three times over**. The codeplug structure is **mapped for the majority of record types** (channels, zones, contacts/talk groups, radio IDs, GNSS/APRS settings, encryption keys, general settings, roaming) at the byte/bit level in qdmr's actual shipped source. Gaps that remain (see Open Questions) are narrow: some unidentified flash-page regions, no confirmed checksum/CRC algorithm, and incomplete write-failure-code semantics. **From-scratch reverse engineering is not required; the work is to port/translate qdmr's GPL-3.0 C++ implementation (and cross-check against the MIT-licensed DM32-Protocol-Spec and NeonPlug) into TypeScript.**

## Serial Connection Parameters

| Parameter | Value | Source |
|---|---|---|
| Baud rate | 115200 | [we8chz.org connection guide](https://www.we8chz.org/?p=966); corroborated by [infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec) and [emuehlstein/dmrconfig_dm32 read_connection.md](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md); also reported in a [Reddit troubleshooting thread](https://www.reddit.com/r/Baofeng/comments/1phuvjr/dm32_not_wanting_to_read/) and a [Facebook CPS troubleshooting thread](https://www.facebook.com/groups/808920029174333/posts/25180372368269093/) |
| Framing | 8N1, no flow control | [infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec) — explicitly flagged there as "host defaults that work," not a confirmed radio requirement (the reference implementation never explicitly sets data bits/parity/stop bits) |
| Physical transport | UART over a CH340 USB-serial adapter inside the Kenwood-style 2-pin programming cable | [emuehlstein/dmrconfig_dm32 read_connection.md](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md) |
| VFO A must be on an analog frequency/memory, not DMR | Required | [we8chz.org](https://www.we8chz.org/?p=966) |
| Volume knob at 50% | Recommended | [we8chz.org](https://www.we8chz.org/?p=966) |
| Radio must NOT be on USB power/charging during programming (RFI interferes with serial) | Required | [we8chz.org](https://www.we8chz.org/?p=966); consistent with general Baofeng DMR guidance that charging is disruptive |
| Avoid high-numbered COM ports | Reported quirk ("the radio does NOT like higher COM ports"; COM10 failed for the reporter) | [we8chz.org](https://www.we8chz.org/?p=966) |
| Radio should be powered on and cable fully/firmly seated before connecting | Required / common failure mode | [Reddit: "Issue with programming a Baofeng DM-32UV"](https://www.reddit.com/r/Baofeng/comments/1mi4cy7/issue_with_programming_a_baofeng_dm32uv/); [Facebook CPS troubleshooting thread](https://www.facebook.com/groups/808920029174333/posts/25180372368269093/) |
| Cable must contain a genuine FTDI/CH340-class USB-serial chip; cheap "straight-through" cables built for other radios do not work | Required | [Reddit: "DM-32 not wanting to read"](https://www.reddit.com/r/Baofeng/comments/1phuvjr/dm32_not_wanting_to_read/); [Reddit: "Issue with programming a Baofeng DM-32UV"](https://www.reddit.com/r/Baofeng/comments/1mi4cy7/issue_with_programming_a_baofeng_dm32uv/) |
| No special "programming mode" button sequence needed for normal CPS read/write (unlike firmware flashing) | Reported | [Facebook CPS troubleshooting thread](https://www.facebook.com/groups/808920029174333/posts/25180372368269093/) — "you don't need to put it into any special mode. Just plug it with the cable and turn it on." Note this contradicts the protocol-level `PROGRAM` mode-entry handshake documented by qdmr/DM32-Protocol-Spec/dmrconfig_dm32, which *is* sent by the CPS software itself — the user does not need to do anything physically, but the software-level handshake still occurs. |
| macOS/Linux notes | Native driver support for the CH340/FTDI cable is inconsistent; many users fall back to a Windows VM (VMware/UTM/Parallels) with USB passthrough | [Reddit: "DM-32UV programming on Mac"](https://www.reddit.com/r/Baofeng/comments/1k9ddec/dm32uv_programming_on_mac/); corroborated by comments on the [NeonPlug Reddit announcement](https://www.reddit.com/r/Baofeng/comments/1pmwp2x/dm32_open_source_cps_neonplugapp/) describing Web Serial connectivity failures on macOS Chrome that only worked in a Windows VM under Edge |
| Firmware-flash mode entry (distinct from normal CPS programming) requires a physical button sequence: power off, hold PTT + button beneath it, then power on; success indicated by a green LED (red LED means retry) | Reported, for firmware upgrades specifically | [YouTube: "UNLOCK - BAOFENG DM32"](https://www.youtube.com/watch?v=5fg3lsRyXLA) |
| Baofeng passcode 374612 required to access "Embedded Information" (MARS mod, frequency unlock, region change) | Reported | [we8chz.org](https://www.we8chz.org/?p=966) |

**Corroboration verdict:** the 115200-baud requirement, the analog-VFO requirement, and the no-USB-charging requirement from [we8chz.org](https://www.we8chz.org/?p=966) are independently corroborated by community reports and by the protocol-level documentation, so they should be treated as reliable preflight requirements for a TypeScript/Web Serial driver.

## Known Protocol Details

All details below are drawn from — and cross-checked between — the raw qdmr GPL-3.0 source ([dm32uv_interface.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_interface.hh)), the MIT-licensed [infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec), and the BSD-3-Clause [emuehlstein/dmrconfig_dm32 read_connection.md](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md). Where sources disagree on a detail, that is noted.

### Handshake / device identification sequence

1. Host sends ASCII `PSEARCH` (7 bytes, no CR). Radio replies with 8 bytes: `0x06` (ACK) followed by a 7-character model string, e.g. `DP570UV` (the DP570UV is a rebadge of the DM-32UV — [infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec)). Confirmed in qdmr as `DeviceDetectionRequest`/`DeviceDetectionResponse` in [dm32uv_interface.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_interface.hh).
2. Host sends ASCII `PASSSTA` (7 bytes). Radio replies with 3 bytes; the only value observed in captures is `50 00 00` (first byte `0x50` = ASCII `'P'`); `50 FF FF` is reported anecdotally in some builds but not directly evidenced ([infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec); [emuehlstein/dmrconfig_dm32](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md)). Modeled as `PasswordRequest`/`PasswordResponse` in qdmr.
3. Host sends ASCII `SYSINFO` (7 bytes). Radio replies with a single `0x06` byte. Modeled as `SysinfoRequest`/`ACKResponse` in qdmr.

### `V`-frame queries (device/memory metadata)

- Opcode: ASCII `'V'` (`0x56`), followed by 3 unused/flag bytes (usually `00 00 00`), then a 1-byte value ID.
- Reply format: `56 <id> <length> <payload>` (echoes the queried ID; length is a single byte).
- qdmr's `ValueRequest`/`ValueResponse` enumerates known IDs: `FirmwareVersion = 0x1`, `BuildDate = 0x3`, `MainConfigMemory = 0xa`, `CallSignDBMemory = 0xf` ([dm32uv_interface.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_interface.hh)).
- `infamy/DM32-Protocol-Spec` and `dmrconfig_dm32` document a fuller catalog (IDs `0x01`–`0x10`, with `0x0C` skipped), each returning either an 8-byte address-range pointer tuple (`0x06`–`0x0F` region pointers) or a version/date/status string, e.g.:
  - `0x0A`: main config memory range, e.g. `56 00 00 00 0A` → response decodes to start `0x001000`, end `0x0C8FFF` (interpretation of the exact byte layout differs slightly between sources — see Open Questions).
  - `0x10`: reported maximum contact count, `56 10 03 50 C3 00` → `0x00C350` = 50,000.
  - `0x0D`: a special one-time 64-byte "capabilities" block, only returned when queried with a non-zero flag byte (`56 00 00 40 0D`); normal polls of `0x0D` return an empty payload.
- Both spec sources agree the V-frame pointer regions describe a dynamic, per-radio, per-firmware memory map (see Codeplug Structure below) — **addresses must be discovered at connect time, not hardcoded**.

### Program-mode entry

- Host sends: `FF FF FF FF 0C 50 52 4F 47 52 41 4D` (4× `0xFF`, length byte `0x0C`, then ASCII `PROGRAM`). Modeled as `EnterProgramModeRequest` in qdmr.
- Radio replies `0x06`.
- Host sends `0x02`. Radio replies with a burst/8 bytes of `0xFF` (modeled as `Unknown02Response` in qdmr — semantics not fully understood by any source).
- Host sends `0x06` (ping). Radio replies `0x06`.
- After this handshake, the radio accepts random-access memory reads/writes.

### Read command

- Opcode: ASCII `'R'` (`0x52`) + 3-byte address + 2-byte length. qdmr's `ReadRequest` documents the address and length as little-endian; `dmrconfig_dm32`'s independent capture analysis describes the address as big-endian in its own notation — **this is a genuine discrepancy between sources that must be resolved empirically against a live capture or the qdmr source's actual byte-packing code** (see Open Questions).
- Response: ASCII `'W'` (`0x57`) header + echoed 3-byte address + echoed 2-byte length + payload of up to 4096 bytes. Modeled as `ReadResponse` in qdmr, matching both other sources' `0x57`-headed reply description.

### Write command

- Opcode: ASCII `'W'` (`0x57`) + 3-byte address + 2-byte length + up to 4096 bytes of payload. Modeled as `WriteRequest` in qdmr.
- `infamy/DM32-Protocol-Spec` explicitly corrects an earlier (incorrect) documentation revision that appended a trailing metadata byte after the 4096-byte payload — the confirmed frame is `57 <addr:3> 00 10 <data:4096>` with **no trailing byte**.
- Every 4 KB write block observed in captures is acknowledged with a single `0x06` byte. No checksum or CRC has been confirmed in any source (see Checksum note below).
- Writing is destructive and there is no protocol-level retry; a bad write can cause the radio to reboot ([infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec)).

### Checksum

**No checksum or CRC scheme has been confirmed by any source.** `infamy/DM32-Protocol-Spec` explicitly states that no checksum algorithm, checksum field, or validation procedure was found in captures, and flags candidate write-failure byte values (`0xC0`, `0xC8`, `0x48`) as unverified guesses — `0xC8` is *speculated* to relate to "checksum error" but this was never observed in any actual capture. Treat "no checksum" as the working assumption until disproven.

### Block size and addressing

- Bulk transfer unit: 4 KiB (`0x1000`) blocks, confirmed identically in qdmr (`DM32UV::Offset::blockSize() = 0x1000`, [dm32uv.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv.hh)), `infamy/DM32-Protocol-Spec`, and `dmrconfig_dm32`.
- Address space: 24-bit, giving a 16 MB addressable range, though only ~0x0A1000 bytes (~652 KB) constitute the actual codeplug payload region used by the OEM CPS ([emuehlstein/dmrconfig_dm32](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md), which measured the OEM factory codeplug file at 659,456 bytes / `0x0A1000`).
- **Physical-to-virtual address indirection**: qdmr's own `DM32UV::AddressMap` class ([dm32uv.hh](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv.hh)) implements exactly the "flash translation layer" behavior independently documented by both `infamy/DM32-Protocol-Spec` and `dmrconfig_dm32`: the codeplug is encoded at fixed *virtual* addresses, but each virtual 4 KB block is physically stored at an address that varies per-radio and per-edit, discovered by reading a 1-byte "logical block ID" at physical-page-base + `0xFFF`. **This address indirection is the single most important and most consistently corroborated structural fact about this radio** across all three independent research efforts (qdmr's own maintainer, `infamy`, and `emuehlstein` all arrived at the same conclusion separately).

## Codeplug Structure

The most complete, concrete, and immediately reusable codeplug structure comes from qdmr's shipped GPL-3.0 header, `lib/dm32uv_codeplug.hh` ([raw source](https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/dm32uv_codeplug.hh)), which defines a `DM32UVCodeplug : public Codeplug` class with nested `Element` subclasses, each declaring an explicit byte size and an `Offset` struct giving field-level (and, for packed flags, bit-level) positions. Verified directly from the raw file content:

### Channel record (`ChannelElement`)
- Size: **48 bytes (`0x0030`)** — independently confirmed by `emuehlstein/dmrconfig_dm32`'s capture-based analysis, which also found 48-byte channel records.
- Field offsets (from qdmr source):

| Field | Offset | Notes |
|---|---|---|
| `name()` | `0x0000` | Channel name label |
| `rxFrequency()` | `0x0010` | |
| `txFrequency()` | `0x0014` | |
| `channelType()` (bitfield) | `0x0018`, bit 4 | FM=0, DMR=1, FMFixed=2, DMRFixed=3 |
| `rxOnly()` (bit) | `0x0018`, bit 3 | |
| `power()` (bit) | `0x0018`, bit 1 | Low/Medium/High |
| `loneWorker()` (bit) | `0x0018`, bit 0 | |
| `bandwidth()` (bit) | `0x0019`, bit 7 | |
| `scanListIndex()` (bit) | `0x0019`, bit 2 | |
| `preventTalkaround()` (bit) | `0x001a`, bit 7 | |
| `admitCriterion()` (bit) | `0x001a`, bit 4 | Always/ChannelFree/ToneOrCCMatch/ToneMismatch |
| `rxDMRAPRS()` (bit) | `0x001a`, bit 2 | |
| `emergencyNotification()` (bit) | `0x001b`, bit 7 | |
| `emergencyACK()` (bit) | `0x001b`, bit 6 | |
| `emergencySystemIndex()` (bit) | `0x001b`, bit 0 | |
| `squelchLevel()` (bit) | `0x001c`, bit 4 | |
| `dmrAPRS()` (bit) | `0x001c`, bit 2 | |
| `privateCallACK()` (bit) | `0x001d`, bit 7 | |
| `dataACK()` (bit) | `0x001d`, bit 6 | |
| `dcdm()` (bit) | `0x001d`, bit 5 | |
| `timeslot()` (bit) | `0x001d`, bit 4 | |
| `colorcode()` (bit) | `0x001d`, bit 0 | |
| `keyIndex()` | `0x001e` | |
| `encryptionEnable()` (bit) | `0x001f`, bit 6 | |
| `groupListIndex()` (bit) | `0x001f`, bit 0 | |
| `dmrAPRSChannelIndex()` (bit) | `0x0020`, bit 0 | |
| `rxTone()` | `0x0021` | |
| `txTone()` | `0x0023` | |
| `vox()` (bit) | `0x0025`, bit 4 | |
| `showPTTId()` (bit) | `0x0026`, bit 7 | |
| `optSigEnable()` (bit) | `0x0026`, bit 4 | |
| `optSigType()` (bit) | `0x0026`, bit 0 | |
| `pttIdEnable()` (bit) | `0x0029`, bit 2 | |
| `dmrIdIndex()` | `0x002b` | |

`dmrconfig_dm32`'s independent capture analysis found a coarser but consistent decomposition of the same 48-byte record — a 16-byte name label, 4-byte RX frequency (reversed-BCD) at what it identifies as offset `+0x1C`, 4-byte TX frequency at `+0x20`, and a 24-byte parameter block — which is broadly consistent with, but less granular than, qdmr's bit-level breakdown. **Note the two sources disagree on the exact byte offset of the name field (`0x0000` in qdmr vs. `+0x0B` in one dmrconfig_dm32 passage) — this should be resolved against the qdmr `.cc` implementation or a live capture, not assumed.**

### Channel bank (`ChannelBankElement` or similar)
- Size: `0x1000` (4 KB), with `channelCount()` at offset `0x0000` and `channelBlock0()` at offset `0x0010` — i.e., a 16-byte bank header followed by channel records.

### Zone-related and index elements
- A small 2-byte index element (`indexMSN()` bit at `0x0000`/bit 4, `indexLSB()` at `0x0001`) is used for cross-referencing.
- An 0x18-byte element with `name()` at `0x0002`, `dmrId()` at `0x0013`, `callType()` at `0x0016` — consistent with a **DMR radio-ID / contact-style record**.
- A large 0x1000-byte block with `contactCount()` (`0x0000`), `groupCount()` (`0x0002`), `privateCount()` (`0x0004`), and `bitmap()` (`0x0010`) — a **contacts index/bank header**.
- A 0x006d-byte element (109 bytes) with `name()` at `0x0000`, `ids()` at `0x000b`, `betweenIds()` stride of `0x0003` — this matches the **contacts/talkgroups region stride of 109 bytes (`0x006D`)** independently reported by `emuehlstein/dmrconfig_dm32`'s V-frame `0x0F` pointer-tuple decoding for the "standard" (non-L01) firmware.
- A 0x1000-byte block with `bitmap()` at `0x0000` and `groupLists()` at `0x0011` — an **RX group list bank**.
- A small 0x0010-byte `id()`/`name()` element — likely scan-list or talk-group entries.
- Additional larger elements sized `0x0100` for `GeneralSettingsElement`, `APRSSettingsElement`, `PasswordSettingsElement`, and `MenuSettingElement`; `0x2c` (44 bytes) for `EncryptionKeyElement` with a `0x600`-byte `EncryptionKeyBankElement`; `0x0081` (129 bytes) for `SMSTemplateElement`; `0x0091` for a further settings-like element; and roaming-zone elements with a `betweenZones()` stride.

**Practical implication:** qdmr's header alone (94 KB of source) contains explicit, compilable field-offset definitions for the great majority of codeplug record types a DMR CPS needs — channels, zones, radio IDs, contacts/talk groups, RX group lists, GNSS/APRS settings, password settings, menu settings, encryption keys, SMS templates, and roaming. The corresponding `.cc` implementation file (`lib/dm32uv_codeplug.cc`, 138 KB) was not fetched in full during this survey but is publicly available at the same repository and should be read directly during implementation — it will contain the encode/decode logic (bit-packing, string encoding, frequency BCD handling) that pairs with each offset above.

### Dynamic memory map (per `infamy/DM32-Protocol-Spec` and `dmrconfig_dm32`)
Both independent spec efforts converge on the same "pointer tuple" scheme returned by V-frame queries `0x06`–`0x0F`: an 8-byte tuple of `{24-bit base address, pad byte, 16-bit mask, 16-bit stride}`, from which a segment size (`mask+1`) and record size (`stride`) can be derived. Reported regions (address, mask, stride) — **treat firmware-version dependence as confirmed, since the L01 firmware variant changes several of these values**:

| V-frame ID | Base address | Segment size | Record size | Component (per dmrconfig_dm32 capture analysis) |
|---|---:|---:|---:|---|
| `0x06` | `0x001020` | 20 KB | 38 bytes | Audio Resource Index |
| `0x07` | `0x00900C` | 40 KB | 20 bytes | Compact Item Table |
| `0x08` | `0x000018` | 4 KB | 32 bytes | Zones |
| `0x09` | `0x00C06D` | 64 KB | variable | Audio Recording (disabled on L01 firmware) |
| `0x0A` | `0x001000` | 36 KB | 12 bytes | Main Config Block |
| `0x0E` | `0x000015` | 24 KB | 23 bytes | Index/Memberships |
| `0x0F` | `0x008027` | 48 KB (64 KB on L01) | 109 bytes (255 on L01) | Contacts/Talkgroups |

This table should be treated as **firmware-version-dependent and subject to confirmation**, not as a fixed universal map — both source documents explicitly warn that block locations shift between codeplugs and firmware builds, which is exactly why the address-indirection / logical-block-ID discovery mechanism exists.

## Prior Art Inventory

| Project | URL | License | What it gives us |
|---|---|---|---|
| **qdmr / libdmrconf** | [github.com/hmatuschek/qdmr](https://github.com/hmatuschek/qdmr) | **GPL-3.0** (confirmed directly from [LICENSE file](https://raw.githubusercontent.com/hmatuschek/qdmr/master/LICENSE)) | The single most valuable source. Fully merged, compilable DM-32UV support (`lib/dm32uv*.{cc,hh}`, ~280 KB of C++) covering the complete serial transport (`dm32uv_interface.{cc,hh}`) and byte/bit-level codeplug structures for channels, zones, contacts, radio IDs, RX groups, settings, encryption keys, SMS templates, and roaming (`dm32uv_codeplug.{cc,hh}`). Same license as the target project — directly portable without any relicensing concern. Confirmed merged and functional for "basic features (read and write)" per the maintainer in [issue #577](https://github.com/hmatuschek/qdmr/issues/577); AM channel support was still pending as of that issue's last update. |
| **DM32-Protocol-Spec** | [github.com/infamy/DM32-Protocol-Spec](https://github.com/infamy/DM32-Protocol-Spec) | **MIT** | Dedicated, prose protocol specification with precise byte sequences for the handshake, V-frame catalog, program-mode entry, read/write frame formats, timing constants (inter-command delays, timeouts), and an honest accounting of what remains unconfirmed (31 unread flash pages, 32 unidentified logical block IDs, no confirmed checksum). Explicitly cross-checked against qdmr's own implementation and cited by qdmr's maintainer as the reference used to build the qdmr device class. |
| **dmrconfig_dm32** | [github.com/emuehlstein/dmrconfig_dm32](https://github.com/emuehlstein/dmrconfig_dm32) | **BSD-3-Clause** | Earlier independent capture-based analysis (forked from [OpenRTX/dmrconfig](https://github.com/sergev/dmrconfig)), whose author explicitly deferred to the later, more thorough `infamy/DM32-Protocol-Spec`. Still useful as a second independent corroboration of the transport, plus specific worked hex examples for channel/zone/contact decoding (e.g., channel name/frequency offsets, contact record layout with a validated `KC9MHE` example, zone bitmask decoding algorithm with per-zone match-rate table). Its detailed read/connection notes live at [dm32_reference/read_connection.md](https://github.com/emuehlstein/dmrconfig_dm32/blob/master/dm32_reference/read_connection.md). |
| **NeonPlug** | [github.com/infamy/NeonPlug](https://github.com/infamy/NeonPlug) (live at [neonplug.app](https://neonplug.app)) | **MIT (asserted in README only — see caveat)** | A real, actively developed (138 commits, 29 stars) TypeScript/React/Vite browser-based CPS using the Web Serial API, by the same author as DM32-Protocol-Spec. Has a dedicated `src/radios/dm32uv/` module (`protocol.ts`, `structures.ts`, `memory.ts`, `blockLayouts.ts`, `connection.ts`, `constants.ts`, `capabilities.ts`, `descriptor.ts`, `settingsProfile.ts`, `types.ts`, `displayOptions.ts`) plus a shared `src/radios/shared/BaseSerialConnection.ts` / `BaseProtocols.ts` abstraction and Web Serial wrapper (`src/radios/shared/serialPort.ts`). This is the closest available example of "what a TypeScript DM-32UV driver looks like" and is MIT-licensed, so it can be used as a structural/API reference or ported directly. Announced at [Reddit r/Baofeng](https://www.reddit.com/r/Baofeng/comments/1pmwp2x/dm32_open_source_cps_neonplugapp/) by author `meshmeld` (GitHub: `infamy` / Alex Harvey). **License caveat, verified against the GitHub API:** the repository contains **no `LICENSE` or `COPYING` file**, and GitHub therefore detects no license for it. The MIT grant exists only as prose in `README.md` ("MIT License - feel free to use this project for your own radio programming needs!"). That is a weak basis for incorporating code into a GPL-3.0 project. **Before porting any NeonPlug code, ask the author to add an explicit `LICENSE` file.** Until then, treat NeonPlug as a structural/API reference to read, not a source to copy from — and prefer qdmr, whose GPL-3.0 grant is explicit and file-backed, as the actual porting source. Author states writing is "still a bit unstable" and the project is "not fully feature-complete," and per the Reddit thread some users report Web Serial connectivity failures on macOS Chrome. |
| **CODEPLUGGER** | [github.com/jimdawdy-hub/codeplugger](https://github.com/jimdawdy-hub/codeplugger) | **MIT** | **Not a serial-protocol or binary-codeplug tool.** It is a repeater/talkgroup database aggregator that outputs four CSV files (`talk_groups.csv`, `rx_group_lists.csv`, `channels.csv`, `zones.csv`) for manual import into the official Baofeng CPS. It never talks to the radio or reads/writes the binary codeplug format. Zero protocol relevance; listed for completeness because it was explicitly named in the task's search terms. |
| **M7OCM/DM-32UV archive** | [github.com/M7OCM/DM-32UV](https://github.com/M7OCM/DM-32UV) (mirrored at [git.chrischro.me/Archive/DM-32UV](https://git.chrischro.me/Archive/DM-32UV)) | **Unlicensed** (no LICENSE file found in the repository listing) | A firmware/CPS/documentation archive (79 stars), not a protocol implementation. Contains the official user manual, firmware binaries, flash-dump tooling, and firmware mods, but no protocol or codeplug-format documentation of its own. Useful as a source of firmware version history and hardware board-revision notes, and credits `RA4FHE` for "research, experimentation, and OpenDM32" — but the archive itself carries no explicit open-source license, so treat any code/binaries found there as "look but don't copy" pending explicit licensing clarification. |
| **OpenDM32 (RA4FHE)** | Referenced from a Russian-language flash-dump-tool forum thread at [infotex58.ru](http://infotex58.ru/forum/index.php?topic=1155.0) and mentioned in a [RadioReference forum thread](http://forums.radioreference.com/threads/opendm32-software.495804/) | **Unknown / unconfirmed** | Could not locate a canonical repository or license for "OpenDM32" itself; the RadioReference thread is a user asking where to find it and expressing safety concerns about a Russian-hosted download link, with no answer provided in the thread. The `infotex58.ru` forum thread documents a general HR_C7000-based flash-dump utility (`OpenUV008.zip`) that also works on several other HR_C7000 radios (Zastone UV008, Abbree DM-8F, Baofeng DM-32, Linton LD-6100, Retevis RT10, Clarigo DP999, Wanneton DP8600) but is a flash-imaging tool, not a documented serial-programming protocol. **Do not use anything from this thread without independently verifying safety and licensing** — it is hosted informally and its provenance/license could not be confirmed. |
| **CHIRP** | N/A | GPL-2.0 (well known) | Explicitly and repeatedly confirmed **not applicable** to the DM-32UV — multiple sources ([dm-32uv.com](https://dm-32uv.com/programming.html), [Baofeng's own guide](https://www.baofengradio.com/blogs/news/programming-the-baofeng-dm-32uv-part-one-preparations), [YouTube walkthrough](https://www.youtube.com/watch?v=b2X4bPrVo8c)) state CHIRP does not support this radio and the OEM CPS must be used instead. Listed to close off a plausible-seeming avenue that does not pan out. |

## Open Questions Requiring Reverse Engineering

Despite the strength of the prior art, the following gaps are real and were **not** resolved by any source found in this survey. Do not invent values for these — verify against a live radio capture or the qdmr `.cc` source before shipping:

1. **Checksum/CRC scheme**: No source confirms whether the DM-32UV uses any checksum, CRC, or other integrity check on written blocks. `infamy/DM32-Protocol-Spec` explicitly says none was found in captures. If the OEM CPS silently relies on none, a from-scratch driver may be able to skip this entirely — but this should be validated (e.g., by writing a deliberately corrupted block and observing radio behavior) rather than assumed.
2. **Write-failure/NAK byte semantics**: The candidate failure codes `0xC0`, `0xC8`, `0x48`, and `0x15` documented in `infamy/DM32-Protocol-Spec` are explicitly labeled as unverified guesses; none were observed in any actual capture. A production driver needs real failure-mode testing to know how to detect and recover from a rejected write.
3. **Address byte order in the read/write frame**: `infamy/DM32-Protocol-Spec` (via qdmr's C++ struct layout) documents the 3-byte address in `ReadRequest`/`WriteRequest` as little-endian, while `emuehlstein/dmrconfig_dm32`'s capture notes describe the same field as big-endian in its own worked examples (e.g. `52 00 80 27 04 00` read at address `0x008027`, which reads left-to-right as big-endian). **This is an unresolved discrepancy between two otherwise-corroborating sources and must be settled by reading qdmr's actual `.cc` byte-packing code or a fresh capture before implementation**, since getting this wrong would corrupt every read/write.
4. **31 unread flash pages / 32 unidentified logical block IDs**: `infamy/DM32-Protocol-Spec` explicitly documents that, of the 200 pages in the main 800 KB configuration region, 31 are allocated but were never read or written by the OEM CPS in either capture used for that analysis, and 32 distinct logical-block-ID byte values were never observed at all. Their purpose is unknown. This likely covers secondary features (e.g., possibly APRS/GPS data or encryption-key storage, per the earlier component-location guesses) not yet needed for a v1 driver, but should be flagged as "unknown, do not touch" in any implementation.
5. **AM channel support**: qdmr's maintainer explicitly noted in [issue #577](https://github.com/hmatuschek/qdmr/issues/577) that AM channel support was still outstanding as of the issue's final update — check the current qdmr `master` branch and changelog to see whether this has since been completed, and if not, treat it as a known gap.
6. **Firmware-version sensitivity of the dynamic memory map**: Both `infamy/DM32-Protocol-Spec` and `dmrconfig_dm32` document that V-frame pointer-tuple values (base addresses, masks, strides for regions like contacts) differ between the standard firmware and the "St Pete" / L01 ANSI variant (`DM32.01.L01.048`). A robust driver must read these pointers dynamically at connect time on every session rather than hardcoding any address — this is already how qdmr's `AddressMap` and the V-frame-based discovery approach work, so this is a design constraint to carry over, not an unknown, but it is worth flagging explicitly since a naive port that hardcodes offsets from a spec document would break across firmware versions.
7. **Complete field maps for scan lists, RX groups beyond the bitmap header, and roaming channels**: qdmr's header defines sizes and some offsets for these but the full picture (especially for scan lists) is thinner in the publicly available documentation than for channels/zones/contacts; the qdmr `.cc` implementation file (not fully read during this survey) likely fills in more detail and should be consulted directly.
8. **NeonPlug's actual TypeScript protocol implementation was not read in full**: This survey confirmed the *existence and file layout* of `src/radios/dm32uv/protocol.ts`, `structures.ts`, `memory.ts`, `blockLayouts.ts`, and `connection.ts` via the GitHub tree API, and confirmed the project is MIT-licensed, but did not fetch and diff the actual TypeScript source against qdmr's C++ implementation due to `robots.txt` restrictions on GitHub's rendered file-tree UI blocking one fetch attempt (the raw content API worked for individual files, as demonstrated with qdmr, and should be used to pull NeonPlug's TypeScript source files directly in a follow-up pass).

## Recommended Next Actions

1. **Adopt qdmr's GPL-3.0 C++ implementation as the primary porting source.** Pull the full contents of `lib/dm32uv_interface.{cc,hh}`, `lib/dm32uv_codeplug.{cc,hh}`, `lib/dm32uv_limits.{cc,hh}`, `lib/dm32uv_callsigndb.{cc,hh}`, and the shared `lib/c7000device.{cc,hh}` base class from [github.com/hmatuschek/qdmr](https://github.com/hmatuschek/qdmr) (all raw files fetchable at `https://raw.githubusercontent.com/hmatuschek/qdmr/master/lib/<filename>`) and translate the transport layer and codeplug `Element`/`Offset` structures directly into TypeScript types and read/write functions. License compatibility is exact (GPL-3.0 → GPL-3.0), so this can be a close port rather than a clean-room reimplementation.
2. **Fetch and read the qdmr `.cc` implementation files in full** (not just headers) — `dm32uv_codeplug.cc` (138 KB) and `dm32uv_interface.cc` (21 KB) in particular — to resolve the address-byte-order discrepancy (Open Question 3) and to extract the encode/decode logic (BCD frequency handling, string encoding, bit-packing helpers) that pairs with the offsets already extracted from the header.
3. **Fetch NeonPlug's TypeScript source files directly via the raw-content API** (`https://raw.githubusercontent.com/infamy/NeonPlug/main/src/radios/dm32uv/protocol.ts` etc.) as a second, TypeScript-native, MIT-licensed cross-check on the same protocol — this is likely to be even more directly reusable than qdmr's C++ since it is already in the target language and already implements Web Serial, matching the intended transport for a browser-based/TypeScript driver.
4. **Cross-reference `infamy/DM32-Protocol-Spec`'s markdown files beyond the summary pulled in this survey** — the repository is explicitly structured with numbered documents (`02-CONNECTION-SEQUENCE.md` is cited directly from qdmr's own source comment; a `05-DATA-STRUCTURES.md` is referenced as containing full byte-level record layouts for channels, zones, scan lists, talk groups, TX contacts, and settings) — fetch these specific files directly rather than relying on the repository's rendered landing page.
5. **Resolve the read/write address byte-order discrepancy (Open Question 3) before writing any code that touches a real radio** — either by inspecting qdmr's actual struct-packing implementation in `dm32uv_interface.cc`, or by capturing a live USB session with the OEM CPS on Windows using a passive serial logger (e.g. `com0com` + a sniffer, or a USB protocol analyzer, following the `-t` tracing approach already built into `dmrconfig_dm32`).
6. **Treat the checksum/failure-code gaps (Open Questions 1–2) as a testing task, not a coding task**: implement writes exactly as documented (no checksum appended) and add defensive logging around the `0x06`/`0xC0`/`0xC8`/`0x48` response bytes so that real-world behavior can be observed and the guesses in `infamy/DM32-Protocol-Spec` confirmed or corrected empirically.
7. **Verify current qdmr `master` status for AM channel support and any post-v0.14.0 fixes** by checking the [qdmr releases page](https://github.com/hmatuschek/qdmr/releases) and the [dm3mat.de supported-radios page](https://dm3mat.de/software/qdmr) before finalizing which qdmr version to port from — the AM-channel gap noted in issue #577 may already be closed in a newer release.
8. **Preserve the address-indirection design (dynamic logical-block discovery) in the TypeScript port** rather than hardcoding any address table from this document — every corroborating source agrees this indirection is real and firmware-version-dependent, so the TypeScript driver's connection sequence should replicate qdmr's `AddressMap` discovery logic (read V-frame pointers, then probe/discover physical page locations at connect time) rather than trusting any fixed offset table, including the ones reproduced in this document's Codeplug Structure section.
