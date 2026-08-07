# USB serial driver installers

This directory is intentionally empty in version control, and this file exists so
that the directory survives a clone.

`electron-builder.yml` copies this path into the packaged application as
`extraResources`. Git does not track empty directories, so without this file a
fresh clone has no `installers/` directory and `npm run package` fails before it
starts building, complaining that the `extraResources` source path is missing.

## Why the drivers are not committed

The cables these radios use are built around third-party USB-serial bridge chips,
and the vendor drivers are **not redistributable** under their own licence terms:

- **Prolific PL2303** — the DM-32UV cable. Prolific's driver package is licensed
  for distribution by Prolific, not by third parties.
- **WCH CH340/CH341** — common on clone cables.
- **Silicon Labs CP210x** — used on some Kenwood-style cables.

This project is GPL-3.0-or-later. Bundling a proprietary, non-redistributable
binary driver into the installer would put the release in breach of both the
vendor's licence and the spirit of ours. The same reasoning that keeps
RepeaterBook data out of the repository applies here: fetch at runtime or have
the user supply it, never redistribute it.

## Populating it for a local build

If you want an installer that ships a driver for your own use, place the vendor
installer here before running `npm run package`. Do not commit whatever you put
here — see the `.gitignore` entry in this directory.

For the DM-32UV specifically, the driver that actually works with counterfeit
PL2303 chips is Prolific's older **3.3.11.152** release. Recent Prolific drivers
deliberately refuse to bind to clone chips and report Code 10, which is the most
common cause of the cable failing to enumerate a COM port at all. See
[docs/DUMP-PROCEDURE.md](../../../../docs/DUMP-PROCEDURE.md).
