# US Radio Frequency Allocation Research — Transmit-Legality Reference

**Purpose:** Source data for a transmit-legality validator in a radio programming application. **Incorrect data here could cause a user to transmit illegally.** Every frequency, power limit, and bandwidth figure below carries an inline citation to a primary source. Where sources conflicted or a figure could not be verified against a primary source, it is marked `CONFLICTING` or `UNVERIFIED` and explained in the [Gaps and Uncertainties](#gaps-and-uncertainties) section — do not silently resolve these in code without re-verifying against eCFR at build time.

**Research date:** August 7, 2026. FCC rules change; a validator built from this document should re-verify against [eCFR Title 47](https://www.ecfr.gov/current/title-47) periodically, and especially before shipping, because at least one of the sections below (60 m amateur band) changed materially in the weeks immediately before this research was performed (effective February 13, 2026).

**Power notation used throughout:** PEP = peak envelope power (measured at the transmitter output/antenna terminal); ERP = effective radiated power (PEP × antenna gain relative to a half-wave dipole, 0 dBd reference); EIRP = equivalent isotropically radiated power (ERP referenced to an isotropic radiator instead of a dipole; EIRP ≈ ERP + 2.15 dB, i.e., EIRP in watts ≈ ERP × 1.64). All three appear in the rules below and are **not interchangeable** — a validator must track which one applies per band/service.

---

## 1. Amateur Radio (FCC Part 97)

Primary sources: [47 CFR §97.301 (authorized frequency bands, via ARRL's verbatim Part 97 text mirror)](https://www.arrl.org/part-97-text), [47 CFR §97.303 (frequency sharing / 60 m channelization)](https://www.arrl.org/part-97-text), [47 CFR §97.305 (authorized emission types)](https://www.arrl.org/part-97-text), [47 CFR §97.313 (transmitter power standards, Cornell Law mirror)](https://www.law.cornell.edu/cfr/text/47/97.313), [eCFR §97.313 landing page](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-D/section-97.313). The ARRL Part 97 mirror states it was last synced January 16, 2024, and (per direct verification below) is **stale on the 60 m band** as of this research — see the dedicated 60 m subsection.

License classes referenced: Technician (T), General (G), Advanced (A), Amateur Extra (E). Novice (N) is included because Novice-class privileges remain codified in current §97.301(e) even though the FCC stopped issuing new Novice licenses after April 15, 2000 — existing Novice licensees may still renew and exercise these privileges ([FCC License Restructuring history via docs.fcc.gov FCC-06-178A1](https://docs.fcc.gov/public/attachments/FCC-06-178A1.pdf); [ARRL history of license changes](https://ema.arrl.org/a-history-of-amateur-radio-license-changes/)).

All frequencies below are for **ITU Region 2** (the US), per [§97.301](https://www.arrl.org/part-97-text). ITU Region 1/3 columns exist in the rule for stations operating outside the US and are not reproduced here.

### 1.1 General power ceiling and universal exceptions

| Rule | Limit | Source |
|---|---|---|
| General maximum, all bands unless overridden below | **1500 W PEP** | [§97.313(b)](https://www.law.cornell.edu/cfr/text/47/97.313): "No station may transmit with a transmitter power exceeding 1.5 kW PEP." |
| 30 m band (10.100–10.150 MHz), all license classes with access | **200 W PEP** | [§97.313(c)(1)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 3.525–3.60 MHz, 7.025–7.125 MHz, 21.025–21.20 MHz, 28.0–28.5 MHz, **only when control operator is Novice or Technician** | **200 W PEP** | [§97.313(c)(2)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 7.050–7.075 MHz, when station is in ITU Regions 1 or 3 | 200 W PEP | [§97.313(c)(3)](https://www.law.cornell.edu/cfr/text/47/97.313) (not applicable to US-based Region 2 stations) |
| 1.25 m band (222–225 MHz), control operator is Novice | **25 W PEP** | [§97.313(d)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 23 cm band (1240–1300 MHz), control operator is Novice | **5 W PEP** | [§97.313(e)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 70 cm band (420–450 MHz), transmitting from designated coordination areas (footnote US270 areas, near certain military radar sites) without case-by-case FCC authorization | **50 W PEP** | [§97.313(f)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 70 cm band, Earth station/telecommand station on 435–438 MHz | 611 W ERP (≈1 kW EIRP) without separate authorization, antenna elevation angle >10° | [§97.313(f)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 33 cm band (902–928 MHz), within 241 km of White Sands Missile Range | **50 W PEP** | [§97.313(g)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 219–220 MHz segment of 1.25 m band | **50 W PEP** | [§97.313(h)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| Spread-spectrum (SS) emission, any band | **10 W PEP** | [§97.313(j)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 76–81 GHz (4 mm band) | **316 W EIRP** peak | [§97.313(m)](https://www.law.cornell.edu/cfr/text/47/97.313) |

**"Minimum power" rule:** independent of all numeric limits, [§97.313(a)](https://www.law.cornell.edu/cfr/text/47/97.313) requires "the minimum transmitter power necessary to carry out the desired communications" at all times — a legality validator enforcing only the numeric ceiling is necessary but not sufficient for full Part 97 compliance; this qualitative requirement cannot be captured by a frequency/power table.

### 1.2 2200 m and 630 m — EIRP-limited, Amateur Extra/Advanced/General only

| Band | Frequency | License classes | Emission modes | Power limit | Source |
|---|---|---|---|---|---|
| 2200 m | **135.7–137.8 kHz** | General, Advanced, Amateur Extra (not Technician or Novice) | RTTY/data (entire band); Phone/Image (entire band) | **1 W EIRP maximum**; also capped at 1.5 kW PEP transmitter power (EIRP is the binding limit in practice) | Frequency range and license classes: [§97.301(b)](https://www.arrl.org/part-97-text). Power: [§97.313(k)](https://www.law.cornell.edu/cfr/text/47/97.313): "No station may transmit in the 135.7-137.8 kHz (2200 m) band with a transmitter power exceeding 1.5 kW PEP or a radiated power exceeding 1 W EIRP." Emission types: [§97.305(c)(1)](https://www.arrl.org/part-97-text) |
| 630 m | **472–479 kHz** | General, Advanced, Amateur Extra (not Technician or Novice) | RTTY/data (entire band); Phone/Image (entire band) | **5 W EIRP maximum**; capped at 500 W PEP transmitter power; **reduced to 1 W EIRP in Alaska for stations within 800 km of the Russian Federation** | Frequency/classes: [§97.301(b)](https://www.arrl.org/part-97-text). Power: [§97.313(l)](https://www.law.cornell.edu/cfr/text/47/97.313): "No station may transmit in the 472-479 kHz (630 m) band with a transmitter power exceeding 500 W PEP or a radiated power exceeding 5 W EIRP, except that in Alaska, stations located within 800 kilometers of the Russian Federation may not transmit with a radiated power exceeding 1 W EIRP." |

Both bands are further restricted to **fixed-location stations only**, require a **1 km exclusion zone from power-line-carrier (PLC) transmission lines**, and require **prior notification to the Utilities Telecom Council (UTC)** at least 30 days before commencing operation — per [§97.303(g)](https://www.arrl.org/part-97-text). These are operational/siting restrictions, not power limits, but a legality validator that only checks power/frequency will miss them; flagging them as a manual-compliance item is recommended.

### 1.3 HF bands (160 m through 10 m)

Frequencies are ITU Region 2 (US). Emission-type sub-segmentation and Novice/Technician's very limited HF access are called out explicitly because they are easy to get wrong.

| Band | Extra (E) | Advanced (A) | General (G) | Novice/Technician (N/T) | Emission notes | Source |
|---|---|---|---|---|---|---|
| 160 m | 1.800–2.000 MHz | 1.800–2.000 MHz | 1.800–2.000 MHz | *no access* | RTTY/data entire band; Phone/Image entire band | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text); emissions [§97.305(c)(2)](https://www.arrl.org/part-97-text) |
| 80 m | 3.500–3.600 MHz | 3.525–3.600 MHz | 3.525–3.600 MHz | 3.525–3.600 MHz (**CW only** for N/T) | RTTY/data on entire 80 m band; N/T and G/A CW-capable sub-segment is 3.525–3.600; 200 W PEP cap applies to N/T here (§97.313(c)(2)) | [§97.301(b)(c)(d)(e)](https://www.arrl.org/part-97-text) |
| 75 m | 3.600–4.000 MHz | 3.700–4.000 MHz | 3.800–4.000 MHz | *no access* | Phone/Image | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text) |
| 60 m | See dedicated §1.4 below — **General class and higher only; special channelized rules, recently changed** | | | *no access* | Phone, RTTY, data, CW per current rule | [§97.301(b)](https://www.arrl.org/part-97-text); [§97.303(h) as amended](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf) |
| 40 m | 7.000–7.300 MHz | 7.025–7.300 MHz | 7.025–7.125 & 7.175–7.300 MHz | 7.025–7.125 MHz (**CW only**) | RTTY/data 7.000–7.100 (E) / 7.025-7.100 (lower classes' portion); Phone/Image 7.075/7.125–7.300 depending on class; 200 W PEP cap applies to N/T | [§97.301(b)(c)(d)(e)](https://www.arrl.org/part-97-text); emission detail [§97.305(c)(3)](https://www.arrl.org/part-97-text) |
| 30 m | 10.100–10.150 MHz | 10.100–10.150 MHz | 10.100–10.150 MHz | *no access* | RTTY/data only, entire band; **200 W PEP hard cap for ALL classes** (§97.313(c)(1)) — this is a rare case where Extra class is also power-limited | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text) |
| 20 m | 14.000–14.350 MHz | 14.025–14.150 & 14.175–14.350 MHz | 14.025–14.150 & 14.225–14.350 MHz | *no access* | RTTY/data 14.00–14.15; Phone/Image 14.15–14.35 | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text) |
| 17 m | 18.068–18.168 MHz | 18.068–18.168 MHz | 18.068–18.168 MHz | *no access* | RTTY/data 18.068–18.110; Phone/Image 18.110–18.168 | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text) |
| 15 m | 21.000–21.450 MHz | 21.025–21.200 & 21.225–21.450 MHz | 21.025–21.200 & 21.275–21.450 MHz | 21.025–21.200 MHz (**CW only**) | RTTY/data 21.0–21.2 (200 W cap for N/T per §97.313(c)(2)); Phone/Image 21.2–21.45 | [§97.301(b)(c)(d)(e)](https://www.arrl.org/part-97-text) |
| 12 m | 24.890–24.990 MHz | 24.890–24.990 MHz | 24.890–24.990 MHz | *no access* | RTTY/data 24.89–24.93; Phone/Image 24.93–24.99 | [§97.301(b)(c)(d)](https://www.arrl.org/part-97-text) |
| 10 m | 28.000–29.700 MHz | 28.000–29.700 MHz | 28.000–29.700 MHz | **28.000–28.500 MHz** (Novice/Tech) | RTTY/data 28.0–28.3; Phone/Image 28.3–29.0 (28.3–28.5 capped at **200 W PEP for N/T** per §97.313(c)(2)); 29.0–29.7 Phone/Image E/A/G only | [§97.301(b)(c)(d)(e)](https://www.arrl.org/part-97-text) |

**Novice/Technician HF summary:** current Technician-class licensees retain the historical Novice HF sub-bands (80 m CW-only 3.525–3.600 MHz, 40 m CW-only 7.025–7.125 MHz, 15 m CW-only 21.025–21.200 MHz, and 10 m 28.0–28.5 MHz including limited phone), per [§97.301(e)](https://www.arrl.org/part-97-text). All of these are capped at **200 W PEP** by [§97.313(c)(2)](https://www.law.cornell.edu/cfr/text/47/97.313), not the general 1500 W ceiling. This is the single most important Technician-specific power exception for a validator to encode correctly.

### 1.4 60 m band — CONFLICTING/recently-changed, channelized, General class and higher only

**This section requires special attention: the rule changed materially on February 13, 2026, very close to this research date, and several otherwise-reliable secondary/mirror sources are stale.**

**Historical rule (pre-February 13, 2026), as still shown in ARRL's Part 97 text mirror and Cornell Law's mirror of §97.313 at the time of this research:** amateur access to 5 discrete channels only, General/Advanced/Extra class, 100 W PEP ERP, USB voice + limited digital, per [ARRL Part 97 text (60 m channel table)](https://www.arrl.org/part-97-text) and [Cornell Law §97.313(i), last verified 2025-10-18](https://www.law.cornell.edu/cfr/text/47/97.313): "No station may transmit with an effective radiated power (ERP) exceeding 100 W PEP on the 60 m band."

**Current rule (effective February 13, 2026), per the Federal Register final rule and confirmed by ARRL's dedicated news post:**

- **Four discrete channels retained** at center frequencies **5332.0, 5348.0, 5373.0, and 5405.0 kHz**, each with a **2.8 kHz maximum occupied bandwidth**, at **100 W ERP** — per [Federal Register Vol. 91, No. 9 (2026-00587), effective Feb. 13, 2026](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf) and [ARRL, "New 60-Meter Frequencies Available as of February 13"](https://www.arrl.org/news/new-60-meter-frequencies-available-as-of-february-13).
  - Carrier-frequency convention for these four channels: for phone (2K80J3E), data (2K80J2D), and RTTY (60H0J2B) emissions, the carrier may be set 1.5 kHz below the channel-center frequency (i.e., 5330.5, 5346.5, 5371.5, 5403.5 kHz); for CW (150HA1A), the carrier is set to the center frequency itself. Source: [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf) (this carrier-offset table matches the pre-2026 rule's convention for the retained channels).
- **The former fifth channel, centered at 5358.5 kHz, is eliminated as a discrete channel.** It now falls inside a new contiguous segment (below) and is subject to that segment's lower power limit — per [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf) and [ARRL news](https://www.arrl.org/news/new-60-meter-frequencies-available-as-of-february-13).
- **New contiguous secondary allocation: 5351.5–5366.5 kHz** (15 kHz wide, not channelized/no sub-channels required), implementing the WRC-15 worldwide 60 m allocation, at **9.15 W ERP (stated by the FCC as equivalent to 15 W EIRP)**, maximum emission bandwidth **2.8 kHz**, all modes (phone, RTTY, data, CW) permitted subject to the bandwidth cap — per [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf) and [ARRL news](https://www.arrl.org/news/new-60-meter-frequencies-available-as-of-february-13). The FCC explicitly declined the higher power levels requested by amateur commenters (up to 500 W ERP) for this new segment.
- **License class requirement is unchanged: General, Advanced, and Amateur Extra only** for both the four legacy channels and the new 15 kHz segment — per [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf).
- **Secondary status, with specific primary users named:** amateurs must not cause harmful interference to, and must accept interference from, US (NTIA/FCC) and other-nation fixed-service stations, and other-nation mobile-except-aeronautical-mobile stations — per [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf), consistent with the pre-existing sharing language at [§97.303(h)](https://www.arrl.org/part-97-text).
- Automatic station control is **not permitted** anywhere in the 60 m band, and data/RTTY operators must limit transmission length to avoid interfering with federal stations — per [Federal Register 2026-00587](https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf).

**`CONFLICTING` — flag for validator maintainers:** as of this research, `law.cornell.edu`'s mirror of §97.313 (last verified by Cornell 2025-10-18) and `arrl.org/part-97-text` (last synced by ARRL January 16, 2024) **both still show the pre-February-2026 rule** (5 channels, uniform 100 W ERP, no 5351.5–5366.5 kHz segment). Only the dedicated ARRL news article and the Federal Register PDF itself reflect the current rule. **A validator must not trust a generic eCFR/Cornell/ARRL Part 97 mirror for the 60 m band without checking the publication date of that specific page.** Recommend hardcoding the post-2026-02-13 values above and re-verifying directly against [eCFR §97.303](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-D/section-97.303) and [eCFR §97.313](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-D/section-97.313) at build/release time, since eCFR's own "current" page could not be fetched directly during this research (see Gaps section).

### 1.5 VHF/UHF bands (6 m through 33 cm)

| Band | Frequency | License classes | Power | Emission modes | Source |
|---|---|---|---|---|---|
| 6 m | **50–54 MHz** | Technician, General, Advanced, Amateur Extra (not Novice) | 1500 W PEP general cap; **CW only** below 50.1 MHz | 50.0–50.1 CW only; 50.1–54.0 MCW, Phone, Image, RTTY/data | [§97.301(a)](https://www.arrl.org/part-97-text); emissions [§97.305(c)(4)(i)(ii)](https://www.arrl.org/part-97-text) |
| 2 m | **144–148 MHz** | Technician, General, Advanced, Amateur Extra (not Novice) | 1500 W PEP general cap; **CW only** below 144.1 MHz | 144.0–144.1 CW only; 144.1–148.0 MCW, Phone, Image, RTTY/data, test | [§97.301(a)](https://www.arrl.org/part-97-text); emissions [§97.305(c)(4)(iii)](https://www.arrl.org/part-97-text) |
| 1.25 m | **219–220 MHz** (data-only, fixed digital message-forwarding only) and **222–225 MHz** | All classes for 222–225 MHz (Novice included, 25 W PEP cap per §97.313(d)); Technician+ for 219–220 MHz | 222–225 MHz: 1500 W PEP general cap (25 W for Novice); 219–220 MHz: **50 W PEP hard cap for all classes** (§97.313(h)) | 219–220: Data only, restricted to fixed point-to-point message forwarding, requires 30-day advance written notice to ARRL of station location (§97.303(l)); 222–225: RTTY/data/test/MCW/Phone/SS/Image | Frequency & sharing: [§97.301(a)](https://www.arrl.org/part-97-text), [§97.303(l)](https://www.arrl.org/part-97-text); power: [§97.313(d), (h)](https://www.law.cornell.edu/cfr/text/47/97.313); emissions: [§97.305(c)(4)(iv)(v)](https://www.arrl.org/part-97-text) |
| 70 cm | **420–450 MHz** | Technician, General, Advanced, Amateur Extra (not Novice) | 1500 W PEP general cap; **50 W PEP** near specified US military radar coordination areas (footnote US270) absent case-by-case FCC authorization; **no transmission north of "Line A"** in 420–430 MHz segment | MCW, Phone, Image, RTTY/data, SS, test — entire band | Frequency: [§97.301(a)](https://www.arrl.org/part-97-text); power/geographic restriction: [§97.313(f)](https://www.law.cornell.edu/cfr/text/47/97.313), [§97.303(m)](https://www.arrl.org/part-97-text); emissions: [§97.305(c)(5)(i)](https://www.arrl.org/part-97-text) |
| 33 cm | **902–928 MHz** | Technician, General, Advanced, Amateur Extra (not Novice) | 1500 W PEP general cap; **50 W PEP** within 241 km of White Sands Missile Range | MCW, Phone, Image, RTTY/data, SS, test, pulse — entire band | Frequency: [§97.301(a)](https://www.arrl.org/part-97-text); power: [§97.313(g)](https://www.law.cornell.edu/cfr/text/47/97.313); emissions: [§97.305(c)(5)(ii)](https://www.arrl.org/part-97-text) |

### 1.6 23 cm band (900 MHz–1.3 GHz range boundary, through 1.2 GHz)

| Segment | Frequency | License classes | Power | Emission modes | Source |
|---|---|---|---|---|---|
| 23 cm, Novice sub-band | **1270–1295 MHz** | Novice (in addition to T/G/A/E who have the full band) | **5 W PEP maximum for Novice** (§97.313(e)) | CW, Phone, Image, MCW, RTTY/data | [§97.301(e)](https://www.arrl.org/part-97-text); power: [§97.313(e)](https://www.law.cornell.edu/cfr/text/47/97.313) |
| 23 cm, full band | **1240–1300 MHz** | Technician, General, Advanced, Amateur Extra | 1500 W PEP general cap (5 W PEP if control operator is Novice, restricted to 1270–1295 MHz sub-band) | MCW, Phone, Image, RTTY/data, SS, test | [§97.301(a)](https://www.arrl.org/part-97-text); emissions: [§97.305(c)(5)(iii)](https://www.arrl.org/part-97-text) |

This document's scope (per the task) runs "through at least 1.2 GHz," and 23 cm (1240–1300 MHz) satisfies that; bands above 23 cm (13 cm/2300–2310 & 2390–2450 MHz, 9 cm, 5 cm, 3 cm, 1.2 cm, and the millimeter-wave/EHF bands) are covered by the same §97.301(a)/§97.303/§97.305 citations above if the validator needs to extend further, but are not tabulated in full detail here since they exceed the requested 1.2 GHz floor.

### 1.7 Summary of power-limit exceptions a validator must encode

1. **1500 W PEP** — default ceiling, all bands/classes unless a row below overrides it. [§97.313(b)](https://www.law.cornell.edu/cfr/text/47/97.313)
2. **200 W PEP** — 30 m (10.1 MHz) band, *all* classes including Extra. [§97.313(c)(1)](https://www.law.cornell.edu/cfr/text/47/97.313)
3. **200 W PEP** — 80 m/40 m/15 m/10 m Novice-heritage sub-bands, *only* when control operator is Novice or Technician. [§97.313(c)(2)](https://www.law.cornell.edu/cfr/text/47/97.313)
4. **60 m: 100 W ERP** on 4 legacy discrete channels; **9.15 W ERP** on the new 5351.5–5366.5 kHz segment (post Feb. 13, 2026) — General class and higher only, both cases. See §1.4.
5. **2200 m: 1 W EIRP** (also 1.5 kW PEP transmitter cap, but EIRP binds first in practice). General class and higher only. [§97.313(k)](https://www.law.cornell.edu/cfr/text/47/97.313)
6. **630 m: 5 W EIRP** (1 W EIRP in specified Alaska/Russia-proximity zone); 500 W PEP transmitter cap. General class and higher only. [§97.313(l)](https://www.law.cornell.edu/cfr/text/47/97.313)
7. **25 W PEP** — 1.25 m band (222–225 MHz), Novice control operator only. [§97.313(d)](https://www.law.cornell.edu/cfr/text/47/97.313)
8. **5 W PEP** — 23 cm band, Novice control operator only. [§97.313(e)](https://www.law.cornell.edu/cfr/text/47/97.313)
9. **50 W PEP** — 70 cm band in designated coordination areas (US270); 33 cm band near White Sands; 219–220 MHz segment (all classes, no exception). [§97.313(f)(g)(h)](https://www.law.cornell.edu/cfr/text/47/97.313)
10. **10 W PEP** — spread-spectrum (SS) emissions, any band. [§97.313(j)](https://www.law.cornell.edu/cfr/text/47/97.313)
11. **316 W EIRP** — 76–81 GHz. [§97.313(m)](https://www.law.cornell.edu/cfr/text/47/97.313)

---

## 2. GMRS (Part 95 Subpart E)

Primary sources: [FCC.gov — General Mobile Radio Service (GMRS)](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/general-mobile-radio-service-gmrs), [47 CFR §95.1763 (GMRS channels), Cornell Law mirror](https://www.law.cornell.edu/cfr/text/47/95.1763), [47 CFR §95.1767 (GMRS transmitting power limits), govinfo.gov PDF](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent), [47 CFR §95.1771 (GMRS emission types)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent).

GMRS requires an individual FCC license (no exam, per-family/household license valid 10 years); it shares 22 of its 30 channels with the license-free FRS service. All 22 shared channels plus the 8 GMRS-only repeater-input channels are listed below using the standard consumer channel numbering (1–22, 15R–22R) confirmed against the FCC's own consumer-facing GMRS page.

| Ch. | Frequency (MHz) | Max power (GMRS) | Bandwidth | Station types | Notes |
|---|---|---|---|---|---|
| 1 | 462.5625 | **5 W ERP** | 12.5 kHz (narrowband) | Mobile, hand-held, base | Shared with FRS (2 W ERP); "462 MHz interstitial" per eCFR structure | [§95.1763(b)](https://www.law.cornell.edu/cfr/text/47/95.1763), [§95.1767(b)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent) |
| 2 | 462.5875 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 3 | 462.6125 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 4 | 462.6375 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 5 | 462.6625 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 6 | 462.6875 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 7 | 462.7125 | **5 W ERP** | 12.5 kHz | Mobile, hand-held, base | Shared with FRS (2 W ERP) | same |
| 8 | 467.5625 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS (also 0.5 W); "467 MHz interstitial" | [§95.1763(d)](https://www.law.cornell.edu/cfr/text/47/95.1763), [§95.1767(c)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent) |
| 9 | 467.5875 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 10 | 467.6125 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 11 | 467.6375 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 12 | 467.6625 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 13 | 467.6875 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 14 | 467.7125 | **0.5 W ERP** | 12.5 kHz | Hand-held only | Shared with FRS | same |
| 15 | 462.5500 | **50 W** (transmitter output power, not ERP) | 20 kHz | Mobile, hand-held, repeater, base, fixed | Shared with FRS (2 W ERP); "462 MHz main channel"; repeater-capable | [§95.1763(a)](https://www.law.cornell.edu/cfr/text/47/95.1763), [§95.1767(a)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent) |
| 16 | 462.5750 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 17 | 462.6000 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 18 | 462.6250 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 19 | 462.6500 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 20 | 462.6750 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 21 | 462.7000 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 22 | 462.7250 | **50 W** | 20 kHz | Mobile, hand-held, repeater, base, fixed | same |
| 15R | 467.5500 | **50 W** | 20 kHz | Mobile, hand-held, control, fixed (repeater input only) | GMRS-only; repeater input for ch. 15 output (462.5500); usable "only when communicating through a repeater station or making brief test transmissions" | [§95.1763(c)](https://www.law.cornell.edu/cfr/text/47/95.1763), [§95.1767(a)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent) |
| 16R | 467.5750 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 16 | same |
| 17R | 467.6000 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 17 | same |
| 18R | 467.6250 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 18 | same |
| 19R | 467.6500 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 19 | same |
| 20R | 467.6750 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 20 | same |
| 21R | 467.7000 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 21 | same |
| 22R | 467.7250 | **50 W** | 20 kHz | same restriction | Repeater input for ch. 22 | same |

**Fixed-station exception:** for the 15–22/15R–22R main channels, [§95.1767(a)(2)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent) caps **fixed stations** (as opposed to mobile/repeater/base) at **15 W**, not 50 W: "The transmitter output power of fixed stations must not exceed 15 Watts."

**Power-measurement basis differs by channel group — this is the single most important nuance for a validator:**
- Channels **1–7 and 8–14** (the 462/467 MHz "interstitial" channels): limit is **ERP** (effective radiated power). [§95.1767(b)(c)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent).
- Channels **15–22 and 15R–22R** (the 462/467 MHz "main" channels): limit is **transmitter output power**, not ERP — i.e., antenna gain is not counted against the 50 W limit on these channels. [§95.1767(a)](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent). A [Reddit discussion citing the rule text](https://www.reddit.com/r/gmrs/comments/12g1a4a/transmit_power_limits/) (aggregator corroboration only, not authoritative) independently confirms this reading of §95.1767(a) as measuring transmitter output, not ERP — meaning a high-gain antenna can legally produce substantially more than 50 W ERP on channels 15–22, unlike channels 1–14 where ERP itself is capped.

**Emission types:** only A1D, F1D, G1D, H1D, J1D, R1D, A3E, F3E, G3E, H3E, J3E, R3E, F2D, and G2D are authorized; every GMRS transmitter type must support F3E or G3E at minimum. Source: [§95.1771](https://www.govinfo.gov/link/cfr/47/95?link-type=pdf&sectionnum=1767&year=mostrecent).

**Frequency tolerance:** GMRS carriers must stay within 5 ppm of channel center (or 2.5 ppm for emissions ≤12.5 kHz occupied bandwidth). Source: [govinfo.gov 47 CFR §95.1765 excerpt, embedded in the §95.1767 PDF](https://www.govinfo.gov/content/pkg/CFR-2022-title47-vol5/pdf/CFR-2022-title47-vol5-sec95-1767.pdf).

---

## 3. FRS (Part 95 Subpart B)

Primary source: [FCC.gov — Family Radio Service (FRS)](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/family-radio-service-frs), corroborated by [FCC Report and Order FCC-17-57A1 (the 2017 rule revision that changed channels 1–7 power)](https://docs.fcc.gov/public/attachments/FCC-17-57A1.pdf) and the current [47 CFR §95.567 FRS transmit power text via govinfo.gov XML](https://www.govinfo.gov/content/pkg/CFR-2017-title47-vol5/xml/CFR-2017-title47-vol5-part95.xml).

**Rule-change note (required by task):** FRS channels 1–7 power was **increased from 0.5 W to 2 W ERP**, and FRS was granted shared access to the GMRS 462 MHz main channels (creating new FRS channels 15–22, also at 2 W ERP) by [FCC Report and Order FCC-17-57A1, released 2017](https://docs.fcc.gov/public/attachments/FCC-17-57A1.pdf): "we are increasing the maximum authorized radiated power limit for FRS channels 1-7 from 0.5 Watts to two Watts, and making the GMRS 462 MHz main channels available to the FRS for use on a shared basis with GMRS. The new channels will be numbered FRS channels 15 through 22... at two Watts ERP." All FRS radios sold in the US since this rule are combination FRS/GMRS-frequency devices operating under FRS rules on the higher-numbered channels. **The table below reflects the CURRENT (post-2017) limits**, which is what a validator should encode.

| Ch. | Frequency (MHz) | Current max power (ERP) | Bandwidth | Source |
|---|---|---|---|---|
| 1 | 462.5625 | **2 W** | 12.5 kHz | [FCC.gov FRS page](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/family-radio-service-frs) |
| 2 | 462.5875 | **2 W** | 12.5 kHz | same |
| 3 | 462.6125 | **2 W** | 12.5 kHz | same |
| 4 | 462.6375 | **2 W** | 12.5 kHz | same |
| 5 | 462.6625 | **2 W** | 12.5 kHz | same |
| 6 | 462.6875 | **2 W** | 12.5 kHz | same |
| 7 | 462.7125 | **2 W** | 12.5 kHz | same |
| 8 | 467.5625 | **0.5 W** | 12.5 kHz | same |
| 9 | 467.5875 | **0.5 W** | 12.5 kHz | same |
| 10 | 467.6125 | **0.5 W** | 12.5 kHz | same |
| 11 | 467.6375 | **0.5 W** | 12.5 kHz | same |
| 12 | 467.6625 | **0.5 W** | 12.5 kHz | same |
| 13 | 467.6875 | **0.5 W** | 12.5 kHz | same |
| 14 | 467.7125 | **0.5 W** | 12.5 kHz | same |
| 15 | 462.5500 | **2 W** | 12.5 kHz | same |
| 16 | 462.5750 | **2 W** | 12.5 kHz | same |
| 17 | 462.6000 | **2 W** | 12.5 kHz | same |
| 18 | 462.6250 | **2 W** | 12.5 kHz | same |
| 19 | 462.6500 | **2 W** | 12.5 kHz | same |
| 20 | 462.6750 | **2 W** | 12.5 kHz | same |
| 21 | 462.7000 | **2 W** | 12.5 kHz | same |
| 22 | 462.7250 | **2 W** | 12.5 kHz | same |

Codified rule text: "Each FRS transmitter type must be designed such that the effective radiated power (ERP) on channels 8 through 14 does not exceed 0.5 Watts and the ERP on channels 1 through 7 and 15 through 22 does not exceed 2.0 Watts." — [47 CFR §95.567 (formerly §95.1971 in some editions), via govinfo.gov](https://www.govinfo.gov/content/pkg/CFR-2017-title47-vol5/xml/CFR-2017-title47-vol5-part95.xml).

**Important legality note for a validator:** FRS is licensed by rule (no individual license needed) but is restricted to **FCC-certificated FRS equipment only** — an amateur or GMRS radio, even one that can be tuned to these exact frequencies, is not legally operable on FRS because FRS certification also constrains things a frequency/power table cannot capture (fixed/integrated antenna, no detachable-antenna capability on true FRS-only devices, no external amplification). This is a device-certification constraint layered on top of the frequency/power table, not visible from frequency and power alone. FRS-only channels **8–14 use the identical frequencies as GMRS interstitial channels 8–14** and are, per FCC rule, the one range where GMRS and FRS have historically had a common 0.5 W limit — the FCC's current combination-device framework treats channels 1–7 and 15–22 as also legal for GMRS at higher power, requiring the validator to know **which service the radio is licensed/configured as** to apply the correct ceiling on the shared 462/467 MHz frequencies.

FRS emission types: F3E, G3E, F2D, G2D only. Source: [§95.1771/§95.571 (FRS emission types), quoted in FCC-17-57A1](https://docs.fcc.gov/public/attachments/FCC-17-57A1.pdf): "Each FRS transmitter type must be designed such that it can transmit only the following emission types: F3E, G3E, F2D, and G2D."

---

## 4. MURS (Part 95 Subpart J)

Primary sources: [FCC.gov — Multi-Use Radio Service (MURS)](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/multi-use-radio-service-murs), [47 CFR §95.2767 (MURS transmitting power limit), via Federal Register 2017-17395](https://public-inspection.federalregister.gov/2017-17395.pdf?1503924325).

MURS is license-free. All 5 channels use FM. No individual license or call sign is required.

| Ch. | Frequency (MHz) | Max power | Authorized bandwidth | Notes | Source |
|---|---|---|---|---|---|
| 1 | 151.820 | **2 W** transmitter power output | **11.25 kHz (narrowband)** | | [FCC.gov MURS page](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/multi-use-radio-service-murs) |
| 2 | 151.880 | **2 W** | **11.25 kHz (narrowband)** | | same |
| 3 | 151.940 | **2 W** | **11.25 kHz (narrowband)** | | same |
| 4 | 154.570 | **2 W** | **20.00 kHz** (wideband relative to ch. 1–3) | Formerly a Business Radio Service ("Blue Dot") frequency, grandfathered into MURS | same |
| 5 | 154.600 | **2 W** | **20.00 kHz** | Formerly a Business Radio Service ("Green Dot") frequency, grandfathered into MURS | same |

Power limit is stated in the current rule as **transmitter power output (conducted power), not ERP** — [FCC.gov MURS page](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/multi-use-radio-service-murs): "No MURS transmitter shall, under any condition of modulation, transmit more than 2 watts transmitter power output," corroborated by the codified rule text at [§95.2767, Federal Register 2017-17395](https://public-inspection.federalregister.gov/2017-17395.pdf?1503924325): "Each MURS transmitter type must be designed such that the transmitter power output does not exceed 2 Watts under normal operating conditions." A historical note found only in a secondary/aggregator source ([transition.fcc.gov Personal Radio Overview slide deck](https://transition.fcc.gov/oet/ea/presentations/files/oct05/Personal_Radio_Overview_AL.pdf), an official FCC-hosted but informal presentation, cited here only as corroboration) states the limit was originally ERP-based and was changed to a conducted-power limit by FCC 02-139 — this history does not affect the current 2 W conducted-power figure a validator should enforce, but explains why some older secondary sources describe MURS power as "2 W ERP" when current primary sources say "2 W transmitter power output" with **no ERP limit** (i.e., external antenna gain is not counted against the MURS power cap, unlike GMRS interstitial channels).

MURS antenna height is separately limited to 18.3 m (60 ft) above ground, or 6.1 m (20 ft) above the highest point of the supporting structure if mounted on a building — an installation restriction, not a power/frequency figure, noted here because it interacts with effective range in ways a naive power-only validator would miss. This antenna-height figure was found in a secondary source ([hfunderground.com wiki, aggregator](https://www.hfunderground.com/wiki/index.php/MURS)) and is `UNVERIFIED` against a primary eCFR citation in this research pass — see Gaps section.

**Narrowband-only channels:** channels 1–3 (151.820/151.880/151.940 MHz) are narrowband-only at 11.25 kHz; channels 4–5 (154.570/154.600 MHz) permit the wider 20 kHz bandwidth. AM voice/data emissions (A3E/A2D) are separately capped at 8.0 kHz on all five channels regardless of the FM bandwidth figures above — this AM sub-limit is sourced only from the same secondary aggregator ([hfunderground.com](https://www.hfunderground.com/wiki/index.php/MURS)) and is `UNVERIFIED` against primary text; flagged in Gaps.

---

## 5. NOAA Weather Radio — RECEIVE ONLY

**These are broadcast channels. Transmission is not applicable — NOAA Weather Radio stations are one-way government broadcast transmitters; consumer/amateur/GMRS/FRS/MURS radios only receive on these frequencies and must never be programmed to transmit on them.**

Primary source: [NOAA/National Weather Service — NOAA Weather Radio](https://www.weather.gov/nwr), corroborated by [NOAA/NWS marine-frequency page](https://www.weather.gov/marine/wxradio).

| Channel label (informal, not FCC-codified) | Frequency (MHz) |
|---|---|
| WX2 | 162.400 |
| WX4 | 162.425 |
| WX5 | 162.450 |
| WX3 | 162.475 |
| WX6 | 162.500 |
| WX7 | 162.525 |
| WX1 | 162.550 |

Source for all seven frequencies: [weather.gov/nwr](https://www.weather.gov/nwr): "Broadcasts are found in the VHF public service band at these seven frequencies (MHz): 162.400, 162.425, 162.450, 162.475, 162.500, 162.525, 162.550." The "WX#" labels are consumer-radio convention, not an FCC designation, and their numbering order is inconsistent across manufacturers — the [weather.gov marine-frequency note](https://www.weather.gov/marine/wxradio) states explicitly: "Channel numbers, e.g., WX1, WX2, etc. have no special significance but are often designated this way in consumer equipment." A validator should key on frequency, not on WX-number, and should mark all seven as **receive-only / TX-prohibited**.

---

## 6. Marine VHF — separate authorization required, summary only

Primary sources: [47 CFR §80.148 (Watch on 156.8 MHz / Channel 16), via customsmobile.com CFR mirror](https://www.customsmobile.com/regulations/expand/title47_chapterI-i4_part80_subpartC_subjgrp53_section80.148), [47 CFR §80.303 (Channel 16 watch requirement), Cornell Law mirror](https://www.law.cornell.edu/cfr/text/47/80.303), [FCC.gov — Ship Radio Stations Operations](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/ship-radio-1), [FCC.gov — Ship Radio Stations Equipment](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/ship-radio-0).

- **Channel 16 = 156.800 MHz** — the international distress, safety, and calling channel. Per [FCC.gov Ship Radio Stations Operations](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/ship-radio-1): "VHF Marine Channel 16 (156.800 MHz) is the international voice, distress, urgency, safety, call, and reply channel for ship, public, and private coast stations." Non-emergency/non-test transmissions ("general calls," routine chatter) on Channel 16 are explicitly prohibited by rule.
- Marine VHF band spans **156–162 MHz**, channelized in 25 kHz (and some 12.5 kHz offset) steps; ship-station transmitter power for Channel 16 and most working channels is bounded (**8–25 W** carrier power typical for fixed marine radios, with a mandated step-down to ≤1 W on certain channels such as 156.375/156.650 MHz), per [govinfo.gov 47 CFR Part 80 PDF excerpt](https://www.govinfo.gov/content/pkg/CFR-2015-title47-vol5/pdf/CFR-2015-title47-vol5-part80.pdf) and [docs.fcc.gov FCC-04-3A1](https://docs.fcc.gov/public/attachments/FCC-04-3A1.pdf). A full channel-by-channel table was not built (task marks this optional) — see Gaps.
- **Most recreational boaters do not need an individual FCC license** to operate a VHF marine radio domestically, per [FCC.gov Ship Radio Stations Equipment](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/ship-radio-0): "You do not need a ship station license to use marine VHF radios..." — but a **Restricted Radiotelephone Operator Permit** is required if the vessel will dock in a foreign port or communicate with foreign stations, and a hand-held marine radio operated **from land** requires a separate **marine utility station license**, per the same source.
- **Marine VHF frequencies are not legal to transmit on amateur, GMRS, or FRS/MURS hardware, even if that hardware can be tuned to 156–162 MHz.** This is a device-certification issue, not merely a frequency-allocation issue: marine radios must be individually type-accepted/certificated for Part 80 maritime use, and amateur (Part 97) equipment is explicitly not certified for this. Corroborating discussion (aggregator/forum-level, not primary, but consistent with the certification requirement in the primary sources above) is found in a [Reddit r/amateurradio thread](https://www.reddit.com/r/amateurradio/comments/11gsyew/can_i_transmit_on_the_marine_vhf_band156174mhz/) and a [USCG Auxiliary district facility-requirements memo](https://uscga-district-7.org/pdf/communications/vhf_radio_facility_requirements.pdf), which states plainly: "Amateur radio 2 meter VHF radios are not acceptable for use on Auxiliary-authorized marine or non-marine VHF frequencies, irrespective of technical capabilities." A validator that flags any attempted transmission at 156–162 MHz from an amateur/GMRS/FRS/MURS device profile as illegal, regardless of the numeric power/frequency being otherwise "in range," is the correct behavior.

---

## 7. Public-domain status and redistribution

**FCC regulations (the Part 95 and Part 97 text, and the Table of Frequency Allocations) are works of the United States federal government and are in the public domain in the United States; they may be freely reproduced and redistributed, including in open-source software, without permission.** Basis: [17 U.S.C. §105](https://www.law.cornell.edu/uscode/text/17/105): "Copyright protection under this title is not available for any work of the United States Government." The House Report on this provision, quoted by [Cornell Law's mirror of §105](https://www.law.cornell.edu/uscode/text/17/105) and by a [library-science summary of the doctrine](https://library.osu.edu/site/copyright/2014/09/24/identifying-united-states-federal-government-documents-in-the-public-domain-2/), confirms: "The effect of section 105 is intended to place all works of the United States Government, published or unpublished, in the public domain." This applies cleanly to the *regulatory text itself* (frequencies, power limits, channel numbers as codified in 47 CFR) — the facts and numbers in Sections 1–6 above, sourced from eCFR/govinfo.gov/Cornell Law mirrors of the CFR and from FCC.gov's own consumer pages, carry no copyright and can be embedded in this application's source code or data files without a license concern.

**This does NOT extend to third-party repeater directories or other value-added compilations**, which is a distinct legal category: a directory of *which specific repeaters exist at which coordinates with which owners/tones* is compiled data, not federal regulatory text, and is separately copyrightable as a compilation even though the underlying frequencies are public facts. Concretely:
- **ARRL's Repeater Directory is explicitly copyrighted** — [arrl.org/copyright](https://www.arrl.org/copyright): "ARRL publications in print and via electronic media are subject to copyright, and all rights are reserved... no part of ARRL published documents or materials may be reproduced... or transmitted in any form... without the express written permission of the American Radio Relay League." The same page allows republishing *factual information* extracted from the directory ("you can republish a list of RF loss specifications... but your list can't look like the list in the ARRL Handbook") but not the directory's compiled presentation itself.
- **RepeaterBook.com's data (which now also powers the ARRL Repeater Directory as of the 2026 edition, per [ARRL's own announcement](https://www.arrl.org/news/now-shipping-the-2026-edition-of-the-arrl-repeater-directory-powered-by-repeaterbook)) is licensed, not public domain**, per [RepeaterBook's own Terms of Use](https://www.repeaterbook.com/resources/articles/12-legal): "Any use of any of the materials on this site other than for private, personal, non-commercial viewing purposes is strictly prohibited unless a license is obtained from RepeaterBook.com," with a required attribution line for any permitted external use, and an explicit ban on building "derivative works" or "competing directories." Bulk/API export and commercial or app-embedded use requires a paid license from RepeaterBook.

**Practical implication for this application:** the *band-plan legality data* in this document (frequencies, power limits, channel numbering, emission types — i.e., everything needed to determine "is this transmission legal") is safe to embed directly as public-domain federal regulatory fact. If the application later adds a **repeater directory** feature (specific repeater locations/owners/tone squelch data for user convenience, as opposed to legality checking), that is a separate data-licensing decision and must not be sourced from RepeaterBook or the ARRL Repeater Directory without a paid license, or must be built from a source that is itself public-domain or openly licensed (e.g., user-contributed data under an explicit open license, which is a different arrangement than either of the two directories described above).

---

## Gaps and Uncertainties

1. **eCFR.gov could not be fetched directly during this research.** Every attempt to fetch `ecfr.gov` pages returned a `broken_content_ip_block` error from the fetch tool. All eCFR-sourced figures in this document were cross-verified via Cornell Law School's Legal Information Institute mirror (`law.cornell.edu/cfr/...`), govinfo.gov's official CFR PDF/XML archive, and/or ARRL's verbatim Part 97 text mirror — all of which quote the operative rule text directly and are treated as reliable, but a validator maintainer should re-run a direct eCFR fetch before shipping to double-check nothing was missed, and should re-check because eCFR is the single canonical "current as of today" source and the mirrors used here are periodically-synced snapshots with stated last-verified dates.

2. **60 m amateur band — `CONFLICTING`, resolved in favor of the most recent primary source, but flagged for extra caution.** As detailed in §1.4, this rule changed effective February 13, 2026, per the Federal Register. Two otherwise-authoritative mirrors (Cornell Law's §97.313 page, last verified 2025-10-18, and ARRL's Part 97 text mirror, synced January 16, 2024) still display the **pre-change** rule (5 channels, uniform 100 W ERP, no 15 kHz segment) as of this research. This document uses the Federal Register text and ARRL's dedicated news article (published January 15, 2026, specifically about this change) as authoritative. **A validator should hardcode a "rule effective date" alongside this data and re-verify directly against eCFR before the codebase ships**, since this is exactly the kind of very-recent change that a stale mirror will silently get wrong.

3. **60 m band 2012-era ARRL FAQ page is badly stale and was excluded as a source.** `arrl.org/60-meter-faq` returned content dated/cached from as far back as 2003 describing the original 2003–2012 5-channel/50W rule, not even the 2012–2026 100W rule, let alone the 2026 change. It was not used as a source for any figure in this document; flagged here only so a future researcher doesn't accidentally treat that specific ARRL URL as current.

4. **MURS antenna height limit (18.3 m / 60 ft, or 6.1 m / 20 ft above a structure) is `UNVERIFIED` against a primary source.** Found only in a wiki/aggregator source (hfunderground.com). Not cross-checked against eCFR §95.2755 or equivalent in this research pass. Do not encode this figure as authoritative without independent verification, though it is highly plausible and consistent with FCC's general antenna-structure rules for license-by-rule services.

5. **MURS A3E/A2D 8.0 kHz sub-bandwidth limit is `UNVERIFIED` against a primary source.** Same aggregator source as #4 (hfunderground.com), not independently confirmed against eCFR §95.2763 or equivalent. If the application supports AM voice/data mode selection on MURS channels, this figure needs primary-source confirmation before being enforced.

6. **GMRS repeater "R" channel labeling (15R–22R) is consumer/retailer convention, not FCC nomenclature.** The primary eCFR text (§95.1763) describes GMRS's 30 channels structurally as "8 main 462 MHz channels / 7 interstitial 462 MHz channels / 8 main 467 MHz channels / 7 interstitial 467 MHz channels" and does not use a 1–22 + 15R–22R numbering scheme at all. The 1–22/15R–22R numbering used in this document (and used by FCC.gov's own consumer-facing GMRS/FRS pages, which this document treats as authoritative for the numbering) is a de facto industry standard that matches how radios are actually labeled and programmed, cross-confirmed across FCC.gov, Wikipedia's detailed table, and two retailer channel charts, so it is safe to use — but a validator's internal channel-numbering model should be documented as "consumer convention, confirmed by FCC.gov's own consumer pages" rather than cited to the CFR channel-numbering language directly, to avoid confusion if someone cross-checks against the raw §95.1763 text.

7. **One retailer aggregator source (albertaradiosupply.com) showed internally inconsistent GMRS channel 5–7 power (50 W where every other source, including FCC.gov and Wikipedia's detailed table, says 5 W).** This is very likely a copy-paste error in that specific page's table and was **not used** for any figure in this document — flagged here explicitly because it's a clear example of why aggregator sources were only used for corroboration, never as a sole source, per the task's sourcing rules.

8. **Marine VHF full channel list (beyond Channel 16) was intentionally not built out**, per the task's explicit statement that "a summary is fine here; full channel list is optional." Ship-station transmitter power figures given in §6 (8–25 W typical, ≤1 W step-down on certain channels) are drawn from a Part 80 PDF excerpt and an FCC order and are representative rather than exhaustive; a validator that needs to gate marine-band transmission should, at minimum, treat the entire 156–162 MHz range as "requires separate Part 80 type-accepted equipment and licensing, not legal on amateur/GMRS/FRS/MURS gear" (per §6) without needing a full per-channel power table, consistent with the task's framing that amateur/GMRS hardware should simply be blocked from this range.

9. **NOAA Weather Radio "WX" channel numbering is inconsistent across manufacturers** (see §5) — the labels WX1–WX7 shown in this document follow one commonly seen ordering (from an aggregator, Wikipedia, cited only for the label-to-frequency mapping convention) but NOAA itself does not assign these labels or guarantee any consistent order; a validator should never key receive-channel logic off "WX-number," only off the raw frequency.

10. **This document does not cover amateur bands above 1.2 GHz** (13 cm/2.3–2.45 GHz, 9 cm, 5 cm, 3 cm, 1.2 cm, and the millimeter/EHF bands), because the task's explicit floor was "through at least 1.2 GHz." If the validator needs to extend coverage upward, §97.301(a) (frequency table) and §97.303 (sharing, including radiolocation/ISM/radio-astronomy coexistence rules for several of these bands) and §97.305(c)(6)-(7) (emissions) are the same primary-source sections already cited in §1 and contain that data; it was simply not transcribed into tables here.

11. **CB (Citizens Band) radio was out of scope per the task** (not one of the six requested services) and is not covered, even though it appeared incidentally in some fetched source material (e.g., channel frequencies in the FCC-17-57A1 order). Not included in any table above.

12. **No numeric figure in this document was taken from memory or inferred by pattern-matching against similar bands.** Every number has an inline citation to either a primary source (eCFR mirror via Cornell Law/govinfo.gov, FCC.gov, or a Federal Register document) or is explicitly marked `UNVERIFIED`/`CONFLICTING` in this section. Where a number could not be found in a primary source within the scope of this research pass (items 4, 5 above), it is flagged rather than guessed.

---

## Audit record — Phase 4 verification

Every figure encoded in `src/shared/frequency/data/` was checked before use. Two
findings changed what got written.

### 1. The 60 m rule was verified against primary source, not a mirror

The 60 m allocation changed effective **13 February 2026** (in force as of this
writing). Because that date falls after the assistant's training cutoff, the
figures were confirmed directly from the amending document rather than from
memory or a secondary summary:

<https://www.govinfo.gov/content/pkg/FR-2026-01-14/pdf/2026-00587.pdf>
(91 FR, ET Docket 23-120, RM-11785, FCC 25-60)

Confirmed rule text as encoded:

- **§ 97.313(i)** — 100 W ERP on 5.332, 5.348, 5.373 and 5.405 MHz; **9.15 W ERP**
  in the 5.3515–5.3665 MHz band. ERP is computed as transmitter PEP times antenna
  gain relative to a half-wave dipole.
- **§ 97.303(h)(3)** — within 5330.5–5406.4 kHz, amateur stations may transmit
  *only* in 5351.5–5366.5 kHz and on those four centre frequencies. Emissions must
  not exceed 2.8 kHz anywhere in the band.
- **§ 97.307(f)(14)** — phone, RTTY, data and CW only.
- General class and above.

Consequence: **5358.5 kHz is no longer a 100 W discrete channel.** It was the
fifth channel under the old rule; only four are retained. It now falls inside the
contiguous band and is limited to 9.15 W ERP. This is covered by a regression test.

### 2. A secondary source fabricated a regulation, and was discarded

`ecfr.gov` is IP-blocked from the build environment and returns an empty body.
When that empty page was fetched through a summarising extraction layer, the
layer **invented a plausible-looking regulation table** rather than reporting the
blank page. Its fabrications included five discrete 60 m channels (retaining
5358.5 kHz), an effective date of 21 March 2025, and a restructured § 97.313(c)
applying a 200 W limit to 30 m, 17 m and 12 m.

All of it was false. The Federal Register text shows § 97.313 was amended only at
paragraphs (f) and (i), so (c) is unchanged and the 200 W limit applies to 30 m
and the Novice-heritage sub-bands, not to 17 m or 12 m.

**Practical rule for future work on this file:** check that fetched content is
non-empty before trusting any summary derived from it, and treat regulatory
figures as unverified until seen in the Federal Register or eCFR text itself.

### 3. Deliberately not encoded

Two figures from the research pass were sourced only to `hfunderground.com`, a
hobbyist site, and could not be traced to Part 95. They are omitted rather than
guessed:

- MURS antenna height limit (reported as 18.3 m)
- MURS A3E/A2D 8.0 kHz sub-bandwidth

Omission means the validator stays silent on them instead of asserting a limit it
cannot cite.
