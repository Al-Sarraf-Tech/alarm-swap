# AlarmSwap

What replaces the smoke alarm on your ceiling. A small static reference site, one page per alarm
model, where every fact links to the maker, NFPA, USFA or CPSC.

Live: https://smokealarmswap.com/

## Stack
- [Eleventy 3](https://www.11ty.dev/) → static HTML, no client JS except search
- [Pagefind](https://pagefind.app/) → static search index
- GitHub Actions → GitHub Pages (`.github/workflows/pages.yml`) on https://smokealarmswap.com/

## Layout
```
src/_data/models/*.yaml   one file per alarm model (facts + replacement, each sourced)
src/_data/guides/*.yaml   one file per guide (sections → facts / brand rows)
src/models/model.njk      renders /models/<slug>/
src/guides/guide.njk      renders /guides/<slug>/
src/_includes/            base layout, citation + sources partials
scripts/check-sources.mjs build gate: every fact needs source_url, source_title, checked (allowed hosts only)
scripts/check-output.mjs  post-build gate: internal links, search index, no affiliate links
templates/                blank model/guide files for new pages
NIGHTLY.md                how a nightly run adds one page
```

## Commands
```bash
npm ci
npm run build    # check → eleventy → pagefind → output check
npm run serve    # dev server (search needs a full build first)
```
Base path is `/` (the custom domain root). A `CNAME` file containing `smokealarmswap.com` is copied into the build. Override with `PATH_PREFIX` only for a subdirectory preview.

## One-time GitHub setup (by a repo admin)
1. Create the empty public repo `Al-Sarraf-Tech/alarm-swap` and push `main`.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
