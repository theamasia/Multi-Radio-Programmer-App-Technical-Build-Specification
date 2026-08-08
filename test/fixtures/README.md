# Hardware fixtures

## `dp570uv-factory-codeplug.bin`

The Phase 1 exit criterion: a complete codeplug read off real hardware, which
every Phase 2 parser is developed against.

| | |
| --- | --- |
| Radio | Reports model `DP570UV`; boot banner reads `DM-32UV` (a rebadge sharing firmware) |
| Firmware | `DM32.00.01.048` |
| Cable | WCH CH340 (`1a86:7523`) |
| Captured | 2026-08-08 |
| Size | 512,000 bytes (125 virtual pages) |
| SHA-256 | `03b2433e9c63eed8f62f79fab934119a5b79859efe951ba335a63b45220eeb8f` |

The radio was never programmed: all names are factory defaults and it contains
no callsign, DMR ID, or contact data. That is why it can live in a public
repository.

### What it confirms about the memory model

- **107 pages allocated, 17 unallocated** inside the mapped range, plus virtual
  page 0. Sparse allocation is normal, not a failed read.
- **Logical IDs are unique** — 107 distinct values, no duplicates. Confirms "one
  page per ID": `0x12` is channel bank *slot 1*, not "a channel block".
- **Virtual page index equals the logical ID** for every mapped page.
- **Physical placement is scrambled**: only 1 of 107 pages sits at its own
  address. Addresses must be discovered, never hardcoded.
- **Virtual page 0 is unrepresentable** and is filled with `0xff`.

### Companion map

`dp570uv-factory-codeplug.map.json` records the virtual-to-physical mapping and
the unallocated pages. Offsets listed in `unmappedPages` are filler, not data,
and must never be written back.
