## Purpose of This Document

This specification defines the full application structure, module boundaries, dependencies, and external references required to build a Windows desktop app for programming multiple radios (Baofeng DM-32UV, GMRS radios, non-DMR ham radios) over USB, with offline-first frequency-database caching by ZIP code. It is written for direct use by a build orchestrator/coding agent, with explicit file structure, package choices, and data-source references consolidated from prior research.[^1][^2][^3][^4][^5][^6][^7][^8]

## Technology Stack

| Layer | Choice | Reference |
|---|---|---|
| Shell | Electron (latest LTS) | Chosen for reuse of existing TypeScript/React/Node.js expertise |
| Language | TypeScript (strict mode) | Matches existing project conventions |
| UI framework | React 18+ | Consistent with `frontier-wake` project stack |
| Serial/USB | `node-serialport` (`serialport` npm package) | Standard Node serial library[^6][^9] |
| Local DB | `better-sqlite3` | Synchronous, fast, ideal for offline-first cache[^10][^11] |
| State management | Zustand or React Context | Lightweight, avoids Redux boilerplate |
| Build/package | `electron-builder` | Produces signed Windows installer (NSIS) |
| Testing | Vitest + Playwright (E2E for Electron) | CI/CD alignment with existing pipeline habits |
| Linting/typechecking | ESLint + TypeScript compiler | Matches existing CI/CD testing/linting/typechecking workflow |

## Repository Structure

```
radio-programmer/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── .eslintrc.cjs
├── src/
│   ├── main/                      # Electron main process
│   │   ci   index.ts               # App entrypoint, window lifecycle
│   │   ├── ipc/                   # IPC handlers (main <-> renderer)
│   │   │   ├── serial.ipc.ts
│   │   │   ├── driver.ipc.ts
│   │   │   ├── profile.ipc.ts
│   │   │   └── frequency-db.ipc.ts
│   │   ├── serial/
│   │   │   ├── SerialManager.ts   # Wraps node-serialport, port discovery
│   │   │   └── portDetection.ts   # VID/PID -> chipset/radio matching
│   │   ├── drivers/                # Radio protocol plugin layer
│   │   │   ├── DriverRegistry.ts
│   │   │   ├── IRadioDriver.ts     # Common interface (see below)
│   │   │   ├── baofeng-dm32uv/
│   │   │   │   ├── driver.ts
│   │   │   │   ├── codeplug.schema.ts
│   │   │   │   └── protocol.ts
│   │   │   ├── baofeng-uv5r-family/
│   │   │   │   └── driver.ts       # Ported from CHIRP analog drivers
│   │   │   ├── gmrs-generic/
│   │   │   │   └── driver.ts
│   │   │   └── ham-analog-generic/
│   │   │       └── driver.ts
│   │   ├── usb-drivers/            # Chipset driver bundling/install
│   │   │   ├── chipset-catalog.json  # VID/PID -> driver package map
│   │   │   ├── installers/          # Bundled redistributable installers
│   │   │   │   ├── CH341SER.EXE
│   │   │   │   ├── CP210xVCPInstaller_x64.exe
│   │   │   │   └── PL2303_Prolific_Setup.exe
│   │   │   └── DriverInstallManager.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── migrations/
│   │   │   ├── SqliteClient.ts
│   │   │   └── seed/
│   │   │       └── gmrs-channels.json   # Hardcoded fixed GMRS channel table
│   │   ├── sync/
│   │   │   ├── RepeaterBookSync.ts
│   │   │   ├── FccUlsSync.ts
│   │   │   └── SyncScheduler.ts     # Background sync when online
│   │   └── zip-lookup/
│   │       ├── ZipToCountyResolver.ts
│   │       └── zip-county-table.json
│   ├── renderer/                   # React UI
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── RadioSelect.tsx
│   │   │   ├── ChannelEditor.tsx
│   │   │   ├── ProfileManager.tsx
│   │   │   ├── FrequencyBrowser.tsx  # ZIP-code search UI
│   │   │   └── DriverHelp.tsx        # Fallback manual driver links page
│   │   ├── components/
│   │   └── hooks/
│   │       ├── useSerialPorts.ts
│   │       └── useFrequencyDb.ts
│   └── shared/
│       ├── types/
│       │   ├── Codeplug.ts
│       │   ├── Channel.ts
│       │   └── RadioProfile.ts
│       └── constants/
│           └── chipsets.ts
├── profiles/                        # User-saved codeplug profiles (JSON)
├── cache/                            # Local SQLite frequency cache (gitignored)
└── docs/
    └── protocol-notes/               # Reverse-engineering notes per radio
        └── dm32uv-protocol.md
```

## Core Interface Contracts

### `IRadioDriver` (radio protocol plugin interface)

Every supported radio implements this interface, mirroring CHIRP's `get_features()`/`get_memory()`/`set_memory()` pattern:[^6]

```typescript
interface IRadioDriver {
  readonly modelId: string;
  readonly displayName: string;
  readonly chipsetVidPid: { vid: string; pid: string }[];
  detect(port: SerialPort): Promise<boolean>;
  getFeatures(): RadioFeatures;         // channel count, zones, DMR support, etc.
  readCodeplug(port: SerialPort): Promise<Codeplug>;
  writeCodeplug(port: SerialPort, codeplug: Codeplug): Promise<void>;
}
```

### `Codeplug` / `Channel` shared types

Normalized schema so profiles are portable across radio models where features overlap (frequency, tone, mode, zone, DMR color code/timeslot/talkgroup fields optional per radio).

## Module-by-Module Build Plan

### 1. Serial + USB Driver Layer (`main/serial/`, `main/usb-drivers/`)

- `chipset-catalog.json` maps known cable VID/PID pairs to required chipset driver package (CH340/CP210x/Prolific), consolidating the reference table from prior research.[^8][^12][^13]
- `DriverInstallManager.ts` checks Windows registry/Device Manager for an installed matching driver; if absent, launches the bundled installer (`CH341SER.EXE`, `CP210xVCPInstaller_x64.exe`, or Prolific setup) with elevation via `child_process.exec` + UAC prompt, then re-enumerates ports.[^12][^14][^15]
- Bundled installers must be sourced from official vendor pages and stored under `main/usb-drivers/installers/`:
  - CH340/CH341: WCH official CH341SER package[^14][^12]
  - CP2102/CP210x: Silicon Labs CP210x Universal Windows Driver[^13][^16]
  - Prolific PL2303: Prolific Technology Inc. official installer[^9][^13]
- Fallback path: if a device doesn't expose a standard COM port, surface a "Drivers" help page (`DriverHelp.tsx`) linking to Zadig for manual WinUSB assignment.[^17][^18]

### 2. Radio Driver Registry (`main/drivers/`)

- `DriverRegistry.ts` auto-detects connected radio by matching VID/PID and/or a protocol handshake, then loads the matching plugin.
- **`baofeng-dm32uv/`**: Built via the reverse-engineering plan — Portmon-style serial capture of the official CPS's read/write operations, diffing memory dumps to isolate channel/zone/DMR-contact structures, cross-referenced against the archived CPS/firmware in `M7OCM/DM-32UV` and structural hints from OpenGD77's HR-C6000-based codeplug documentation.[^3][^4][^19]
- **`baofeng-uv5r-family/`** and other **non-DMR ham drivers**: ported directly from CHIRP's existing GPL-3.0 Python drivers, translating the memory-map/channel-struct logic to TypeScript. This should be built first since it requires no new reverse-engineering.[^2][^1][^6]
- **`gmrs-generic/`**: for GMRS-capable radios, reuses the analog channel-write logic with the fixed 30-channel GMRS frequency table pre-loaded (462/467 MHz main + interstitial channels), and enforces the transmit-license note for channels 1–7 and 15–22.[^20][^21][^22]

### 3. Local Database & Offline-First Sync (`main/db/`, `main/sync/`)

- `schema.sql` defines tables: `repeaters`, `gmrs_repeaters`, `fcc_licenses`, `zip_county_map`, `sync_metadata` (per-table last-synced watermark).
- `SqliteClient.ts` wraps `better-sqlite3`; all UI reads go through this local DB first, never directly hitting network APIs (offline-first pattern).[^10][^11]
- `RepeaterBookSync.ts`: background job hitting RepeaterBook's `export.php`/`exportROW.php` JSON endpoints with the required `x-api-key`/`RBApp-Token` header and compliant User-Agent, upserting into `repeaters`/`gmrs_repeaters` tables. Must respect RepeaterBook's personal-use-only license terms.[^23][^5][^24]
- `FccUlsSync.ts`: optional secondary sync pulling FCC ULS weekly/daily amateur database dumps (`a_amat.zip`) for license/callsign validation, using logic adapted from `hamkit-uls` or `QueuingKoala/fcc-db`.[^25][^26][^27]
- `SyncScheduler.ts`: triggers sync attempts on app start and on network-reconnect events; all syncs are idempotent upserts keyed by record ID so interrupted syncs are safe to resume.[^11][^10]
- `seed/gmrs-channels.json`: the 30 fixed GMRS channels bundled directly in the app (no network dependency, since these never change).[^22][^20]

### 4. ZIP-Code Resolution (`main/zip-lookup/`)

- `zip-county-table.json`: offline ZIP-to-county/state lookup table bundled with the app, since RepeaterBook queries by state/county/coordinates, not ZIP directly.[^23]
- `ZipToCountyResolver.ts`: resolves user-entered ZIP to state/county before querying the local `repeaters` cache table, then optionally filters by proximity if lat/long is available per repeater record.

### 5. Profile Management (`main/ipc/profile.ipc.ts`, `profiles/`)

- Profiles saved as versioned JSON files per radio model, containing the full `Codeplug` object; supports named multi-profile save/load/export, mirroring CHIRP's backup/restore workflow.[^28][^29]

### 6. Renderer / UI (`src/renderer/`)

- `RadioSelect.tsx`: dropdown/auto-detect UI; on selection, triggers `DriverInstallManager` check and `DriverRegistry` load.
- `ChannelEditor.tsx`: channel/zone/DMR-contact grid editor bound to the active `Codeplug`.
- `FrequencyBrowser.tsx`: ZIP-code input → local DB query → filterable list (mode: analog/DMR/GMRS; service tag: ARES/RACES/SKYWARN) → one-click "add to channel list."
- `DriverHelp.tsx`: manual driver links page (Zadig, vendor chipset pages) as a fallback if silent install fails.

## External Reference Index (for Orchestrator)

| Resource | URL/Package | Use |
|---|---|---|
| CHIRP source (driver reference) | github.com/kk7ds/chirp | Port analog radio protocol logic[^1] |
| CHIRP "Add a Radio" guide | chirpmyradio.com/projects/chirp/wiki/DevelopersAdd_a_Radio | Reverse-engineering methodology[^6] |
| DM-32UV archive | github.com/M7OCM/DM-32UV | Official CPS/firmware dumps for protocol analysis[^3] |
| OpenGD77 | github.com/open-ham/OpenGD77 | DMR codeplug/protocol structural reference[^4][^19] |
| RepeaterBook API | repeaterbook.com/wiki/doku.php?id=api | Amateur + GMRS repeater data source[^23][^24] |
| hamkit-repeaterbook | pypi.org/project/hamkit-repeaterbook | Reference implementation for RepeaterBook local caching[^5] |
| FCC ULS downloads | fcc.gov/wireless/data/public-access-files-database-downloads | Public-domain license data[^25] |
| hamkit-uls | pypi.org/project/hamkit-uls | Reference implementation for ULS parsing[^27] |
| node-serialport | npmjs.com/package/serialport | Core serial communication library |
| CH340 driver | WCH official site / CH341SER package | Bundled chipset driver[^12][^14] |
| CP210x driver | Silicon Labs CP210x Universal Windows Driver | Bundled chipset driver[^13][^16] |
| Prolific PL2303 driver | Prolific Technology Inc. official site | Bundled chipset driver[^13][^9] |
| Zadig | zadig.akeo.ie | Fallback WinUSB driver assignment[^17][^18] |
| GMRS/FRS channel chart | wiki.radioreference.com/index.php/FRS/GMRS_combined_channel_chart | Fixed GMRS channel table source[^30][^22] |

## Build Order for Orchestrator

1. Scaffold Electron + TypeScript + React project with the file structure above; wire up `electron-builder` config.
2. Implement `SerialManager`, `chipset-catalog.json`, and `DriverInstallManager` (chipset driver detection/bundled install).
3. Implement `IRadioDriver` interface and port 1–2 CHIRP analog drivers (non-DMR ham) as the first working end-to-end path.
4. Implement `SqliteClient`, schema, and `seed/gmrs-channels.json`; wire `FrequencyBrowser.tsx` against local-only data first (no network yet).
5. Implement `RepeaterBookSync.ts` and `SyncScheduler.ts` once RepeaterBook API token is obtained; connect background sync to the existing local-first read path.
6. Implement `ProfileManager` save/load against the shared `Codeplug` schema.
7. Begin DM-32UV reverse-engineering track in parallel (`docs/protocol-notes/dm32uv-protocol.md`) using Portmon capture + diffing method; implement `baofeng-dm32uv/driver.ts` once protocol is mapped.
8. Add GMRS-generic driver and license-requirement UI notes.
9. Add FCC ULS secondary sync as a stretch goal for license/callsign validation.
10. Full E2E pass: radio auto-detect → driver install → codeplug read/write → profile save → frequency import from ZIP search.

---

## References

1. [GitHub - kk7ds/chirp: Official git repo for the CHIRP project](https://github.com/kk7ds/chirp) - Official git repo for the CHIRP project. Contribute to kk7ds/chirp development by creating an accoun...

2. [CHIRP - Microsoft Marketplace](https://marketplace.microsoft.com/en-us/product/saas/bcloudllc1671615348068.chirp?tab=overview) - Version 20250102 + Free Support on Ubuntu 24.04

3. [GitHub - M7OCM/DM-32UV: Archive of Baofeng CPS and firmware for the DM-32UV DMR radio](https://ited.edu.kg/M7OCM/DM-32UV) - Archive of Baofeng CPS and firmware for the DM-32UV DMR radio - M7OCM/DM-32UV

4. [OpenGD77: flashing GD-77, DM-1801, RT3S, MD-UV380 — step by step](https://dmrhub.ru/tech/en/opengd77) - How to install the free OpenGD77 firmware on Radioddity GD-77, Baofeng DM-1801, Retevis RT3S and TYT...

5. [hamkit-repeaterbook · PyPI](https://pypi.org/project/hamkit-repeaterbook/) - A tool for working with local copies of the RepeaterBook database. Visit https://www.repeaterbook.co...

6. [DevelopersAdd a Radio](https://chirpmyradio.com/projects/chirp/wiki/DevelopersAdd_a_Radio) - How to add a new radio driver. Here's what you'll need: a subscription to the developers mailing lis...

7. [Quick Search for GMRS Repeaters](https://www.repeaterbook.com/gmrs/)

8. [BaoFeng USB Programming Cable for Two-Way Radios (CH340 Chip) Instruction Manual](https://eu.manuals.plus/asin/B0DYDBDY11) - This instruction manual provides detailed information on the BaoFeng USB Programming Cable with CH34...

9. [USB Programming Cable will not work on my new ...](https://www.reddit.com/r/Baofeng/comments/13wp7sp/usb_programming_cable_will_not_work_on_my_new/) - I purchased a USB Programming Cable back in 2014 on Amazon and programmed my UV-5R radios and hadn't...

10. [Offline-First Mobile Apps: The Architecture Patterns](https://burncode.org/blog/offline-first-mobile-architecture) - Real users have flaky networks. Offline-first is not optional for serious mobile products — here are...

11. [Ux Patterns For Offline](https://www.thegarnetwiki.com/mobile-engineering/mobile-offline-architecture/) - Design mobile applications that function seamlessly offline, syncing data when connectivity returns....

12. [Manually Install Driver for ESP32¶](https://docs.sunfounder.com/projects/esp-cam-kit/en/latest/faq/install_driver.html)

13. [Windows下串口驱动安装原创 - CSDN博客](https://blog.csdn.net/tugepaopaoo/article/details/119277754) - 文章浏览阅读3.5w次，点赞10次，收藏69次。在嵌入式开发中，USB转TTL工具常用于电脑与设备间的数据监控。本文提供了CH340/CH341、FT232、CP2102和PL2303四种常见USB转...

14. [CH340 Drivers for Hobby Components Products](https://github.com/hobbycomponents/ch340-drivers) - CH340 Drivers for Hobby Components Products. Contribute to HobbyComponents/CH340-Drivers development...

15. [Installing CP2102 or CH340 USB Driver. V1.3 28/07/2024](https://manuals.plus/m/88f15acfad3a92006de50c77582834070625b01764d879e58fde787249d6d4c6)

16. [Download CP2102 Driver on Windows System – ACEBOTT](https://acebott.com/stem-blogs/download-cp2102-driver-on-windows-system/) - Download CH340 driver Download CH340 driver Installation Connect the controller board to your comput...

17. [Zadig - USB driver installation made easy](https://zadig.akeo.ie/) - Zadig is a Windows application that installs generic USB drivers, such as WinUSB, to help you access...

18. [Driver - Zadig - USB driver installatie (Windows)](https://conxxion.nl/?page_id=15133) - Zadig is a Windows application that installs generic USB drivers, such as WinUSB, libusb-win32/libus...

19. [OpenGD77 / OpenGD77S / OpenDM1801 / OpenRD5R ...](https://dd1go.de/wp-content/uploads/2025/08/OpenGD77_User_Guide.pdf)

20. [General Mobile Radio Service (GMRS)](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/general-mobile-radio-service-gmrs) - AboutRule Part47 C.F.R, Part 95 Subpart ERadio Service Code(s)ZA - GMRS

21. [[PDF] GMRS/FRS FREQUENCY CHART (MHz) - FCC Report](https://fcc.report/FCC-ID/XUI10WT0001/1253266.pdf)

22. [551](https://www.govinfo.gov/content/pkg/CFR-2023-title47-vol5/pdf/CFR-2023-title47-vol5-sec95-1767.pdf)

23. [API](https://www.repeaterbook.com/wiki/doku.php?id=api)

24. [repeaterbook.com API with new authorization necessary Need Help!](https://www.reddit.com/r/amateurradio/comments/1s5fyor/repeaterbookcom_api_with_new_authorization/) - repeaterbook.com API with new authorization necessary Need Help!

25. [Public Access Files - Database Downloads](https://www.fcc.gov/wireless/data/public-access-files-database-downloads) - The Universal Licensing System (ULS) and Antenna System Registration (ASR) databases offer public ac...

26. [GitHub - QueuingKoala/fcc-db: FCC Amateur Radio License database generation](https://github.com/QueuingKoala/fcc-db) - FCC Amateur Radio License database generation. Contribute to QueuingKoala/fcc-db development by crea...

27. [hamkit-uls](https://pypi.org/project/hamkit-uls/) - A tool for working with local copies of the FCC Universal Licensing System (ULS) database dumps (e.g...

28. [User Manual](https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_User_Manual_20250210.pdf) - The DM-32UV DMR radio has 250 Zones. A Zone can have the maximum of 64 analog and/or digital channel...

29. [DM-32UV Encryption Setup: A Step-by-Step Guide](https://www.baofengradio.com/blogs/news/dm-32-encryption-setup-guide) - Use your Baofeng programming cable to connect your Windows computer to your DM-32 radio · Open the C...

30. [FRS/GMRS combined channel chart](https://wiki.radioreference.com/index.php/FRS/GMRS_combined_channel_chart)

