#!/usr/bin/env node
// IndexNow: tell Bing, Yandex, Naver, Seznam and Yep which URLs are new or changed after a deploy.
// Free, no account. The key is public by design: it must be served at the site root as <key>.txt.
// Google does not take part in IndexNow.
//
//   node scripts/indexnow.mjs plan     # before deploy: compare built _site/sitemap.xml with the live one
//                                      #   and print a JSON array of new or changed URLs
//   URLS_JSON='[...]' node scripts/indexnow.mjs submit [--dry-run]
//                                      # after deploy: check the key file is live, then POST the URLs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/site.json"), "utf8"));
const SITE = String(site.url).replace(/\/$/, "");
const HOST = new URL(SITE).host;
const KEY_DIR = path.join(ROOT, "public");
const keyFile = fs.readdirSync(KEY_DIR).find((f) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(f));
if (!keyFile) throw new Error("No IndexNow key file in public/");
const KEY = keyFile.replace(/\.txt$/, "");
if (fs.readFileSync(path.join(KEY_DIR, keyFile), "utf8").trim() !== KEY) throw new Error("Key file content must equal its file name");
const KEY_URL = `${SITE}/${keyFile}`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";

function parseSitemap(xml) {
  const out = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/g)) out.set(m[1].trim(), (m[2] || "").trim());
  return out;
}

async function plan() {
  const built = parseSitemap(fs.readFileSync(path.join(ROOT, "_site/sitemap.xml"), "utf8"));
  let live = new Map();
  try {
    const res = await fetch(`${SITE}/sitemap.xml`, { headers: { "cache-control": "no-cache" } });
    if (res.ok) live = parseSitemap(await res.text());
    else console.error(`live sitemap returned HTTP ${res.status}; treating every URL as new`);
  } catch (e) {
    console.error(`live sitemap fetch failed (${e.message}); treating every URL as new`);
  }
  const changed = [...built].filter(([url, lastmod]) => live.get(url) !== lastmod).map(([url]) => url);
  console.error(`IndexNow plan: ${changed.length} new or changed of ${built.size} sitemap URLs`);
  console.log(JSON.stringify(changed));
}

async function submit() {
  const dry = process.argv.includes("--dry-run");
  const urls = JSON.parse(process.env.URLS_JSON || "[]").filter((u) => new URL(u).host === HOST);
  if (!urls.length) { console.log("IndexNow: nothing to submit"); return; }
  // The key file must be live before the search engines fetch it.
  let ok = false;
  for (let i = 0; i < 6 && !ok && !dry; i++) {
    try { const r = await fetch(KEY_URL, { headers: { "cache-control": "no-cache" } }); ok = r.ok && (await r.text()).trim() === KEY; } catch {}
    if (!ok) await new Promise((r) => setTimeout(r, 10000));
  }
  if (!ok && !dry) throw new Error(`Key file not live at ${KEY_URL}`);
  for (let i = 0; i < urls.length; i += 10000) {
    const batch = urls.slice(i, i + 10000);
    const body = { host: HOST, key: KEY, keyLocation: KEY_URL, urlList: batch };
    if (dry) { console.log(`DRY RUN: would POST ${batch.length} URLs to ${ENDPOINT}`); console.log(JSON.stringify(body, null, 2).slice(0, 1500)); continue; }
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    console.log(`IndexNow: POST ${batch.length} URLs -> HTTP ${res.status} ${res.statusText}`);
    // 200 = accepted, 202 = accepted and key validation pending. Anything else is reported.
    if (![200, 202].includes(res.status)) throw new Error(`IndexNow rejected the submission: HTTP ${res.status} ${await res.text()}`);
  }
}

const cmd = process.argv[2];
if (cmd === "plan") await plan();
else if (cmd === "submit") await submit();
else { console.error("usage: indexnow.mjs plan | submit [--dry-run]"); process.exit(2); }
