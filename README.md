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
src/brands/               brand hubs (Kidde, Firex, First Alert/BRK) from the same data
src/_includes/            base layout, citation + sources partials
src/llms.njk              /llms.txt and /llms-full.txt for AI search
scripts/check-sources.mjs build gate: every fact needs source_url, source_title, checked (allowed hosts only)
scripts/check-output.mjs  post-build gate: internal links, search index, structured data, no affiliate links
templates/                blank model/guide files for new pages
Dockerfile                multi-stage static image (GitHub Pages stays the live host)
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

## Run it yourself (Docker)

GitHub Pages is the live host. This image is for a self-hosted copy of the same static files: Node builds the site, then nginx serves it on port 8080 with gzip, brotli, a real 404 page, and long cache headers on hashed CSS.

```bash
docker compose up -d
```

The site is at http://localhost:8080/. The first run builds the image. Later starts reuse it; `docker compose up -d --build` picks up content changes. Stop with `docker compose down`.

Put it on the internet without opening the port:

- **Cloudflare Tunnel:** `cloudflared tunnel --url http://localhost:8080` (or a named tunnel whose public hostname points at that URL).
- **Reverse proxy:** point the proxy at `127.0.0.1:8080` and terminate TLS there. A Caddy site block is `reverse_proxy 127.0.0.1:8080`. An nginx site block is `proxy_pass http://127.0.0.1:8080;`.

Map a different host port with `docker compose up -d` after changing `8080:8080` in `docker-compose.yml` (host:container). The process inside the container keeps listening on 8080.

Affiliate store links stay off until `affiliates_enabled` in `src/_data/site.json` is `true`. See `NIGHTLY.md` for the `where_to_buy` field.
