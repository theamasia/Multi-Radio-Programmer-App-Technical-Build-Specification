# DM-32UV codeplug structures

Derived by reading `test/fixtures/dp570uv-factory-codeplug.bin`, a factory
image pulled from real hardware (radio reports model `DP570UV`, boot banner
`DM-32UV`, firmware `DM32.00.01.048`). Page IDs below are logical block IDs,
which the address map translates to physical addresses.

Everything marked **decoded** has a byte-identical round-trip test: parse the
structure, write the parsed values straight back, and assert the image is
unchanged. That catches a wrong field offset, because writing a
misinterpreted value back lands on the wrong bytes.

## Decoded

### Channels -- pages `0x12`-`0x41`

16-byte page header, byte 0 is the record count. 48-byte records: `name[16]`
at `+0x00`, RX frequency at `+0x10`, TX at `+0x14`, both 4-byte little-endian
packed BCD in units of 10 Hz. Page `0x42` holds TX contact indices.

25 channels present.

### Zones -- pages `0x5c`-`0x64`

16-byte page header, byte 0 is the zone count. 145-byte (`0x91`) records:
`name[16]` at `+0x00`, channel count at `+0x10`, then up to 64 channel numbers
as 16-bit little-endian values, 1-based.

Two zones: `Zone 1` holds channels 1-16, `Func Demo` holds 17-25. Those cover
all 25 channels exactly once, which is an independent check on both the zone
stride and the channel count -- an off-by-one in either would break the
partition.

### Contacts -- page `0x44`

No page header and no count field was found; records start at the page base.
24-byte records: `name[16]` at `+0x02`, 24-bit little-endian DMR ID at `+0x13`,
call type at `+0x16`.

Ten contacts. `Contacts 1`-`9` carry IDs 1-9. `Contacts 10` carries
`0xffffff`, the DMR All Call broadcast address, which is what identified the
ID field's width and byte order in the first place.

Because there is no count field, the parser stops at the first record without
a usable name. That is a heuristic, not the radio's own rule, and it is worth
revisiting if a codeplug ever turns up with a gap in the contact list.

**Call type is exposed as a raw byte, not an enum.** The image uses `0x03`
(contacts 6-9), `0x04` (contacts 1-5) and `0x05` (contact 10). Only `0x05` is
confirmed, since it is the record holding the All Call ID. Guessing which of
`0x03` and `0x04` means group versus private would put an unverified claim
into the type system, where later code would trust it.

### Name padding

Channel and zone names are padded with `0x00`. Contact names are padded with
`0xff`, in the same image -- `Contacts 2` is followed by `00 ff ff ff ff ff`.

So the writer emits the name plus a single `0x00` terminator and leaves the
remaining bytes untouched. Normalising the padding to either value would
corrupt the other structure's round-trip. A 16-character name fills the field
and gets no terminator.

## Not decoded

These are read as names only, or not at all. They are recorded here so the
partial state is visible rather than looking like an oversight.

### RX groups -- page `0x0f`

Header byte 0 is `0x1f`. Records appear to start at `0xf010` with a stride of
109 (`0x6d`) bytes; five groups are present, named `RX Group 1`-`5`.

Member lists are 3-byte little-endian contact IDs. A first attempt read them
at record `+0x0b` and produced 256, 512, 768, 1024, 1280 -- each the correct
value shifted left by 8, i.e. a one-byte offset error. The raw bytes at
`0xf01b` are `00 01 00 00 02 00 00 03 00 00 04 00 00 05 00`, so the real IDs
are 1-5 and the list starts at `0xf01c`.

That implies an 11-byte name field, which leaves 97 bytes for the entries.
97 is not divisible by 3, so at least one of the assumed stride, the record
start, or the name field width is still wrong. Not implemented until that
resolves.

### Scan lists -- page `0x11`

One-byte header holding the count (2). Records appear to start at `0x11001`
with a stride of 57 (`0x39`) bytes, named `Scan List 1` and `Scan List 2`.

A byte after the name holds `0x10` (16) for the first and `0x09` (9) for the
second, matching the two zones' channel counts exactly. That is suggestive but
not proof, and both names happen to be exactly 11 characters, so the name
field width cannot be pinned down from this image alone. The member list
alignment is unresolved.

### Radio settings -- page `0x04`

`Welcome` banner at `0x4001`, `DM-32UV` at `0x400f`. Offset `0x4040` holds
`49 14 05 00` (333385), unidentified. The owner confirmed the radio carries no
custom settings, so every value here is a factory default.

## Getting further

The ambiguities above are all cases where one image cannot distinguish between
layouts -- two same-length names, or a count that coincides with another
structure's count. A second codeplug with deliberately varied content (names
of different lengths, a scan list with a distinctive channel count) would
separate them quickly. That means changing settings on the radio, which is a
write operation, so it belongs after Phase 3.
