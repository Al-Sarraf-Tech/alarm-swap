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
- **No affiliate links** until Jamal turns `affiliates_enabled` on. See "Affiliate links" below. Do not flip that flag in a nightly run.
- Do not push, open PRs, or change GitHub settings unless the run was explicitly told to.

## 1. Pick the page
Take the first unchecked item in the backlog below. Skip it (and note why in the commit message
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

## Affiliate links (off until Jamal turns them on)

Leave `affiliates_enabled` set to `false` in `src/_data/site.json`. While it is false, a model page does not render store links, and the output check fails if one shows up.

To stage a program on one model, add this to that model's YAML. These URLs are not fact sources. Do not put a store URL in `source_url`.

```yaml
where_to_buy:
  - label: "Retailer — product name"
    url: https://example.com/product
    retailer: Retailer
```

When Jamal sets `affiliates_enabled` to `true`, the template prints that list with `rel="sponsored nofollow noopener"` and a disclosure line that links to `/disclosure/`. Numbered citations stay `rel="nofollow"` and are never store links. Update the disclosure page in the same commit if the wording needs to match the program.

## 6. Upkeep (one extra task per week, not per night)
Re-open the sources of the oldest page, fix anything that changed, bump its `checked` dates.

## Backlog (in order)
- [x] Guide: How to find your smoke alarm's date and when it expires, by brand
- [x] Kidde i12060 / i12060A
- [x] Kidde i12040 / i12040A
- [x] Firex i4618 / i4618AC
- [ ] Kidde i12010S / i12010SCO
- [ ] Kidde KN-COSM-IBA (smoke + CO)
- [ ] First Alert 9120B (hardwired)
- [ ] Adapter: First Alert/BRK ADK-12 (Kidde/Firex plug → First Alert/BRK)
- [ ] Adapter: Kidde KA-B3 and 20-9003 (→ Kidde)
- [ ] Guide: Can you mix brands on interconnected alarms? Kidde vs First Alert, side by side
- [ ] Kidde 20SAR (current model page)
- [ ] Kidde P4010ACSCO
