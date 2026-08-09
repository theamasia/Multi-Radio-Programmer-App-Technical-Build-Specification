# Second dump: resolving the undecoded structures

The first fixture is a factory image. Everything still undecoded in
`docs/protocol-notes/dm32uv-codeplug-structures.md` is undecoded for the same
reason: in a factory image, too many values coincide. Both scan lists have
11-character names. Both scan-list channel counts happen to equal the two zone
channel counts. There is no way to tell a fixed-width field from a variable one
when every example is the same width.

A second dump, taken after deliberately varied settings are entered **on the
radio itself**, breaks those ties. It stays entirely within the read path, so
there is no risk of a bad write.

It also produces something Phase 3 needs: a known-good byte delta. Once the app
can patch an image, it must produce the same delta the radio produced for the
same edit. Without this dump there is nothing to check a write against except
the radio itself, which is the expensive way to find out you were wrong.

## Before you start

- **Keep the factory fixture.** Write the new dump to a different filename. The
  factory image is the only pristine copy and it cannot be restored until
  Phase 3 works.
- **Use the arbitrary values below, not your real ones.** Do not enter your
  callsign or your actual DMR ID. This fixture may be committed to a public
  repo, exactly as the first one was.
- **The radio keeps these settings afterwards.** They are cosmetic (names and
  list membership), but reverting means re-entering them by hand or doing a
  factory reset.

## The edits

Each one is chosen to break a specific ambiguity. The values are deliberately
odd so they are easy to find in a hex dump and unlikely to collide with
something else.

### 1. Scan list names of clearly different lengths

- Rename `Scan List 1` to `AB`
- Rename `Scan List 2` to `SCANLISTLONGNAME` (16 characters)

Resolves the name field width, since both current names are 11 characters and
therefore indistinguishable from a variable-width field. The 16-character name
also exercises the case where a name exactly fills its field and gets no
terminator, which the writer handles but has never seen in real data.

### 2. Scan list membership, distinct from the zone counts

- Set `Scan List 1` to hold exactly three channels: **2, 7 and 20**

The current scan-list counts are 16 and 9, which are also the two zones'
channel counts. That coincidence is precisely what makes the current reading
unprovable. Three non-consecutive channels are unmistakable.

### 3. RX group name and member count

- Rename `RX Group 1` to `RG`
- Set `RX Group 1` to contain exactly two contacts

This attacks the arithmetic that does not add up: the assumed 109-byte stride
leaves 97 bytes for 3-byte entries, and 97 is not divisible by three. Changing
the member count will show where the count field lives and where the entry list
actually starts.

### 4. A new contact with a distinctive ID

- Add an 11th contact named `QQ` with DMR ID **3141592**

Confirms the record stride past the tenth contact. More importantly, the
contact parser currently stops at the first record without a name, because no
count field was ever found. If a count field does exist, adding a contact will
change it from 10 to 11 somewhere, and the diff will point straight at it.

### 5. A third zone

- Create a zone named `ZZ` containing only channel 25

The zone header count byte should move from 2 to 3. Zones are already decoded,
so this is a cheap confirmation that the parse holds beyond two records.

### 6. The radio's own DMR ID

- Set the radio ID to **1234567**

The radio ID structure has not been located at all. Setting a distinctive value
lets the diff tool find it by searching for its encoding.

### 7. Boot banner text

- Change the welcome text to `DIFFTEST`

Page `0x04` holds the settings, but only the banner strings are identified, and
the value at `0x4040` is still unexplained. A known string change anchors the
page.

## Taking the dump

**Power-cycle the radio after making the edits, before dumping.** Some radios
only flush settings to flash on power-off rather than when you leave the menu.
If the diff comes back empty, this is the first thing to suspect.

Then, with the cable attached:

```powershell
npm run dump -- --out test\fixtures\dp570uv-edited-codeplug.bin
```

Everything else works as in `docs/DUMP-PROCEDURE.md`, including the `--port`
override if the cable is not detected automatically.

## Reading the result

```powershell
npm run diff -- test\fixtures\dp570uv-factory-codeplug.bin test\fixtures\dp570uv-edited-codeplug.bin
```

The diff groups changed bytes into runs, labels each with the logical page and
the structure that lives there, and shows the before and after bytes with their
ASCII. To locate a structure by a value you set:

```powershell
npm run diff -- test\fixtures\dp570uv-factory-codeplug.bin test\fixtures\dp570uv-edited-codeplug.bin --find 1234567
```

That tries the value as 16-, 24- and 32-bit little-endian and as packed BCD,
and reports every hit. A value with many hits is probably coincidence; the
useful ones are those that also appear in the changed runs.

## If you would rather split it

All seven edits in one dump is fine, because the diff separates changes by page
and the edits mostly touch different structures. The one place a single dump is
slightly muddier is the scan lists and RX groups, where a name change and a
membership change land in the same record. If you want the cleanest possible
signal there, take one dump after edits 1, 5, 6 and 7, and a second after
edits 2, 3 and 4. It is not necessary, only tidier.
