# NIGHTLY.md — how one nightly run adds one page

One run = **one new page**, fully sourced, build green, one commit. Nothing else.

## 0. Ground rules (never skip)
- Sources allowed: the alarm **maker's** own pages/PDFs, **NFPA**, **USFA**, **CPSC**. Nothing else
  (no retailers, forums, other directories). The build rejects other hosts (`ALLOWED_HOSTS` in
  `scripts/check-sources.mjs`); add a maker's domain there only when adding that maker's first page.
- Open every source **during this run**. `checked` = today's date (America/Chicago), quoted: `"2026-11-01"`.
- Write every sentence yourself. No copied paragraphs, tables or images. Short model names, part
  numbers and figures are fine.
- If a source doesn't say it, the page doesn't say it. Write "not stated by the maker" or "the page did
  not name a replacement when we checked" instead of guessing.
- **Amazon Associate links are on.** Do not set `affiliates_enabled` back to false, do not add another retailer, and do not invent an ASIN. See "Affiliate links" below.
- Do not push, open PRs, or change GitHub settings unless the run was explicitly told to.

## 1. Pick the page
Take the first unchecked item in the Priority queue, then in the backlog below. Skip it (and note why in the commit message
of the next run) if its maker pages can't be read.

## 2. Research (15–30 min)
1. Find the maker's product page and user guide PDF (`curl -sL ... | pdftotext`). For discontinued
   models, the maker's replacement/"upgrade to" note and any adapter guide that lists the model.
2. Pull only facts you can point to: sensor, power/backup battery, date-code location, replacement
   interval, low-battery/end-of-life signals, interconnect limits, named replacement, adapter.
3. CPSC: link `https://www.cpsc.gov/Recalls` as the place to check; only state a recall if you read
   the specific CPSC recall notice for that model (then cite that notice).

## 3. Write the data file
- Model page: `cp templates/model.yaml src/_data/models/<brand>-<model>.yaml`
- Guide page: `cp templates/guide.yaml src/_data/guides/<slug>.yaml`
- `slug` must equal the file name. Model pages need ≥3 `facts` and ≥1 `replacement` fact.
- Each fact: `id`, `label` (models/brand rows), `value`, `source_url`, `source_title`, `checked`.
- Link it in: add the slug to `related:` of 1–2 existing model pages, and to the matching brand row's
  `models:` in `src/_data/guides/smoke-alarm-date-and-expiry.yaml` if relevant.

## 4. Build and look
```bash
npm ci            # first time on a fresh checkout
npm run build     # = source check → eleventy → pagefind → output check
```
It must end with both `✓ Source check passed` and `✓ Output check passed`. To eyeball it:
```bash
python3 -m http.server 8765 -d _site   # open http://localhost:8765/
```
Read the new page top to bottom on a narrow window; click 2–3 citation links.

## 5. Commit
```bash
git add src/_data templates scripts NIGHTLY.md
git commit -m "Add model: Kidde i12010S (sources checked 2026-11-01)"
```
Once the repo exists on GitHub and pushing is approved, pushing `main` runs
`.github/workflows/pages.yml`, which repeats the same build and deploys to
https://smokealarmswap.com/.

## Affiliate links (Amazon Associates, on)

`affiliates_enabled` is `true` in `src/_data/site.json`. The only tracking id is `amazon_tag` in that same file (`alarmswap-20`). Do not hardcode `?tag=` in YAML, and do not turn the flag off in a nightly run.

A model or guide page lists the products it already names in `pages` inside `src/lib/amazon.js`. The template prints one link per product: `rel="sponsored nofollow noopener"`, `target="_blank"`, straight to `https://www.amazon.com/...`. The line next to those links is "As an Amazon Associate I earn from qualifying purchases." and it links to `/affiliate-disclosure/`. Pages with no listed product still show that line on model, guide, and brand pages. Numbered citations stay `rel="nofollow"` and are never store links.

Use `https://www.amazon.com/dp/<ASIN>?tag=...` only when `asins` in that file already has the ASIN, or you opened the Amazon page and its model number and a count of 1 match. Otherwise leave the ASIN off and the template builds `https://www.amazon.com/s?k=<Brand+Model>&tag=...`. Never invent an ASIN. Do not show an Amazon price, star rating, or Amazon product image. Do not put these links in `llms.txt`, `llms-full.txt`, email, or a PDF. Walmart, Ace, Home Depot, and X-Sense stay unlinked.

`/affiliate-disclosure/` is the public disclosure. `/disclosure/` only points there.

## 6. Upkeep (one extra task per week, not per night)
Re-open the sources of the oldest page, fix anything that changed, bump its `checked` dates.

## Done outside the backlog
- 2026-11-12: authorized search-impressions batch (not the one-page nightly). The chirping guide gained question-style sections with
  sourced answers from Kidde's support pages: still chirping after a new battery (reset, loose battery, sealed battery), chirping at a fixed time or when a fan runs
  (surge, neutral wire, environment), and a CO alarm's chirp mistaken for the smoke alarm's. The one-month-battery fact is now an FAQ question. IndexNow added (key file at the site root, ping step in the
  Pages workflow). `lastmod` still follows the newest fact date.
- 2026-11-08: authorized improvement batch, not the one-page nightly. Sitemap `lastmod` on the home page and the model, guide, and brand indexes now follows the newest fact date. `/llms.txt` and `/llms-full.txt` are in the sitemap, and `robots.txt` names them. New guide: why a hardwired alarm is chirping. Sensing-chamber fault chirp added on the i12040 and Firex i4618 pages from their manuals. The mix-brands page now links the 20SAR and P4010ACSCO and cites those two manuals' interconnect limits. CPSC's recalls URL returned HTTP 403 from this run's network, so no new CPSC fact was added and older CPSC lines were not re-checked.
- 2026-11-04: `/privacy/` page (footer link, sitemap, llms.txt). Cloudflare claims on it link to Cloudflare's own pages.
- 2026-11-04: catch-up run for the missed Oct 31–Nov 3 nights (four backlog pages in one run).

## Priority queue (search-demand review, 2026-11-12). Take these before the model backlog, in order
Why this order: Google autosuggest and recent Reddit threads show what people type. "are kidde and first alert
compatible" (the mix-brands guide answers it) and "kidde hardwired smoke alarm no green light / blinking red /
flashing red" are near the top for Kidde; "first alert hardwired smoke alarm chirping / red light flashing" for First
Alert; "kidde i12010sco replacement" and "firex i4618ac replacement" for discontinued models. Reddit threads in r/homeowners,
r/HomeImprovement, r/AskElectricians and r/electrical keep asking whether an old plug or harness fits a new alarm.
Each item is one guide page unless it says model page. Sources stay maker, NFPA, USFA or CPSC. Where two maker pages
disagree, say so and send the reader to the model manual (the chirping guide does this for Kidde's 5 s vs 15 s reset hold).
- [x] Guide: **What do the red, green and amber lights on a hardwired Kidde alarm mean?** (done 2026-11-12, /guides/kidde-hardwired-alarm-lights/) Cover "no green light", blinking or flashing red,
  and the P4010ACSCO red/amber lights from the manuals already cited on the model pages (i12060A, i12040A, i12010S, KN-COSM-IBA,
  P4010ACSCO, 20SA10, 20SAR, 30CUA10, 30CUAR). One row per manual; do not generalise one model's LED code to another.
- [x] Guide: **Will my old hardwired smoke alarm plug fit a new alarm?** (done 2026-11-13, /guides/old-smoke-alarm-plug-fit/; CPSC returned 403 so no recall line, First Alert help-center articles would not load so no FA same-brand harness claim) Harness vs adapter vs cutting and splicing, by brand family. Use the Kidde
  alarm-replacement and harness-match facts, First Alert's ADK-12 / ADF pages, and the pages already on the 20-9003, KA-B3 and ADK-12 model pages.
  Say what each maker states and where a maker says nothing. Do not give wiring steps; link NFPA's electrician line.
- [x] Guide: **First Alert / BRK hardwired alarm chirping, flashing red or green: what the manual says** (done 2026-11-14, /guides/first-alert-hardwired-alarm-chirping/; 9120B and SMI100-AC manuals only.
  SMI105-AC and SM100V-AC manuals not yet read: add rows when their model pages are built. CPSC still 403, no recall line.) Mirror the Kidde chirping guide's structure.
- [x] First Alert / BRK ADF adapter (done 2026-11-15, /models/first-alert-adf/; the ADF guide names Firex 4618 (FADC) but not the i4618/i4618AC, so the page says so and points to Kidde's 20-9003. CPSC still 403.) (Firex-side plug; the Firex 1218 / i4618 replacement question). It is not the ADK-12 and not Kidde's 20-9003.
- [x] Guide: **Kidde 20SA10 vs 20SAR vs 30CUA10: what differs?** (done 2026-11-16, /guides/kidde-20sa10-vs-20sar-vs-30cua10/; three data sheets + DETECT user guide re-read. CPSC still 403, no recall line.) Side-by-side from the three model pages' maker sources. No ranking, no "best".
- [x] Guide: **Can a hardwired alarm be replaced with a battery-only or wireless one?** (done 2026-11-17, /guides/replace-hardwired-smoke-alarm-with-battery-or-wireless/; NFPA smoke-alarm FAQ + installing page and USFA smoke-alarms page only. Neither says yes/no for a given home, so the page says so and sends readers to the local fire marshal. No code text opened, none cited. CPSC still 403.) NFPA and USFA only; say that local code and the
  inspector decide, and that interconnect is what hardwired adds. Do not cite code sections the run did not open.
- [ ] Guide: **Which smoke alarm replaces a Firex i4618AC?** (discontinued; the model page already has the maker's named replacement. Add the
  ADF adapter fact once the ADF page exists.)
- [ ] First Alert SMI105-AC (below, moved up: it is the 10-year-battery sibling people compare)

## Backlog (in order)
- [x] Guide: How to find your smoke alarm's date and when it expires, by brand
- [x] Kidde i12060 / i12060A
- [x] Kidde i12040 / i12040A
- [x] Firex i4618 / i4618AC
- [x] Kidde i12010S / i12010SCO
- [x] Kidde KN-COSM-IBA (smoke + CO)
- [x] First Alert 9120B (hardwired)
- [x] Adapter: First Alert/BRK ADK-12 (pre-2004 Kidde plug → First Alert/BRK; Firex needs the ADF plug, per First Alert)
- [x] Adapter: Kidde KA-B3 and 20-9003 (→ Kidde)
- [x] Guide: Can you mix brands on interconnected alarms? Kidde vs First Alert, side by side
- [x] Kidde 20SAR (current model page)
- [x] Kidde P4010ACSCO
- [x] Kidde 20SA10 — the upgrade named on the i12010S product page. Read that page and the 20SA10 guide or data sheet before writing. Do not copy the i12010S page.
- [x] Kidde 30CUA10 — the replacement named on the P4010ACSCO page. The data sheet is already cited there; re-read it and the product page.
- [x] Kidde 30CUAR — the upgrade named on the KN-COSM-IBA page. Read its product page and manual, including whether it keeps the voice alerts.
- [x] First Alert SMI100-AC — the replacement named in the 9120B specifications. Read the SMI100-AC page for sensor type, power, and interconnect limits.
- [x] First Alert / BRK ADF adapter — moved to the priority queue (2026-11-12); done 2026-11-15.
- [ ] First Alert SMI105-AC — the 10-year-battery sibling compared on the SMI100-AC page. Read its product page and manual; do not reuse SMI100-AC text. (Also in the priority queue; one page only.)
- [ ] First Alert SM100V-AC — the photoelectric voice-alert sibling on the SMI100-AC page. Read its product page and manual for backup battery type and interconnect list.
