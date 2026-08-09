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

## What the radio can and cannot do from the keypad

Not every edit is possible without the vendor CPS software, so the plan is
split. Round one needs nothing but the radio itself.

Menu paths below are quoted from the DM-32UV manual
([manuals.plus](https://gl.manuals.plus/ae/1005009174631341)). Some copies of
that manual are machine-translated, so an item shown there as `Editar nome`
appears as **Edit Name** on an English radio.

| Structure | Keypad? | Why |
|---|---|---|
| Scan lists | **Yes** | `Scan -> Scan List` has Edit Name, Add Chan and per-channel Delete |
| Radio ID | **Yes** | `Settings -> Channel Set -> Radio ID` has Edit ID and Edit Name |
| Zones | **Partly** | `Zone` has Add Channel; creating a zone from scratch is not documented |
| Contacts | **No** | The manual gives no front-panel procedure for name plus DMR ID plus call type |
| RX groups | **No** | No front-panel menu exists for them at all |
| Boot text | **No** | No front-panel menu for the power-on display text |

## Round one: keypad only

This resolves the scan lists completely, locates the radio ID structure, and
re-confirms the zone parse. No software to install and nothing writes to the
radio except its own menu system.

### 1. Rename both scan lists

`Main Menu -> Scan -> Scan List -> [select list] -> Edit Name`

- Scan list 1 becomes `AB`
- Scan list 2 becomes `SCANLISTLONGNAME`

Both current names are 11 characters, which is exactly why the field width
cannot be pinned down. Two lengths that differ settle it. The 16-character name
also exercises a name that exactly fills its field and gets no terminator,
which the writer handles but has never seen in real data.

If the radio refuses a name that long, use the longest it accepts and say what
the limit was. That limit is itself the answer.

Letters are typed on the numeric keypad; `#` switches input method and the back
key deletes a character at a time.

### 2. Cut scan list 1 down to three channels

`Main Menu -> Scan -> Scan List -> [list 1] -> Edit/View List -> [channel] -> Delete`

then

`Main Menu -> Scan -> Scan List -> [list 1] -> Add Chan`

Target membership: **channel 1, channel 7, channel 20**.

Note the manual's restriction: the first channel in a scan list cannot be
deleted. So delete everything below it, leaving one member, then add 7 and 20.

The current counts are 16 and 9, which happen to equal the two zones' channel
counts. That coincidence is the whole problem. Three non-consecutive channels
cannot be confused with anything else in the image.

### 3. Set a distinctive radio ID

`Main Menu -> Settings -> Channel Set -> Radio ID -> Edit ID`

- ID becomes **1234567**, then `Edit Name` becomes `RIDTEST`, then **Save**

The radio ID structure has not been located anywhere in the image. A
distinctive value can be found by searching for its encoding, which is what the
diff tool's `--find` does.

Use that number, not your own DMR ID. The first fixture is already public and
this one probably will be too.

### 4. Add a channel to a zone

`Main Menu -> Zone -> [select Func Demo] -> Add Channel -> [channel 1]`

The zone's count byte should move from 9 to 10. Zones are already decoded, so
this is a cheap confirmation that the parse holds when a zone changes. It
deliberately breaks the tidy property that the zones partition the channels
exactly once, which is a fair test of whether anything quietly depended on it.

## Round two, only if needed: the CPS

Contacts, RX groups and boot text need Baofeng's own programming software,
available from the [Baofeng download area](https://www.baofengradio.com/pages/download)
(CPS V1.60 and V1.45 are listed for the DM-32UV). Round one may well be enough,
so there is no reason to install it yet.

Two things worth knowing if you do. The CPS can read the radio and save the
codeplug to a file, which is a genuine restore path this project does not have
yet, so back up the factory configuration in the CPS before changing anything.
And download only the CPS. The download area also offers firmware, which has
nothing to do with this and carries real risk.

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
