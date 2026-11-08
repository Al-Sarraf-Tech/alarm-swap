#!/usr/bin/env node
// Post-build gate: internal links resolve, search index exists, no affiliate links slipped in,
// and JSON-LD parses with the fields each page type requires.
import fs from "node:fs";
import path from "node:path";
import { checkStructuredData } from "./check-schema.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = path.join(ROOT, "_site");
const PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/?$/, "/");
const AFF = /([?&](tag|aff|affid|aff_id|affiliate|irclickid|clickid|ref_)=)|amzn\.to|sjv\.io|shareasale|awin1\.com|anrdoezrs|dpbolvw|jdoqocy|kqzyfj|tkqlhce|linksynergy/i;
// Cookie-free Cloudflare Web Analytics in the base layout. Not an affiliate link.
const NON_AFFILIATE_HOSTS = new Set(["static.cloudflareinsights.com"]);
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/site.json"), "utf8"));
const affiliatesEnabled = site.affiliates_enabled === true;

function hostOf(url) {
  try { return new URL(url, "https://smokealarmswap.com").hostname.toLowerCase(); }
  catch { return ""; }
}

const errors = [];
const files = [];
const titles = new Map();
const descriptions = new Map();
(function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") && files.push(p); } })(SITE);

function meta(html, attr, key) {
  const re = new RegExp(`<meta[^>]*\\s${attr}="${key}"[^>]*\\scontent="([^"]*)"`, "i");
  return html.match(re)?.[1] || "";
}

for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  const rel = path.relative(SITE, f);
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const url = m[1];
    const sponsored = /\srel="[^"]*\bsponsored\b/.test(tag);
    if (AFF.test(url) && !NON_AFFILIATE_HOSTS.has(hostOf(url)) && !(affiliatesEnabled && sponsored)) {
      errors.push(`${rel}: affiliate-looking link ${url}`);
    }
    if (!affiliatesEnabled && sponsored) errors.push(`${rel}: sponsored link rendered while affiliates_enabled is false: ${url}`);
  }
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (url.startsWith("/") && !url.startsWith("//")) {
      if (!url.startsWith(PREFIX)) { errors.push(`${rel}: root link missing path prefix ${PREFIX}: ${url}`); continue; }
      const clean = url.slice(PREFIX.length).split(/[?#]/)[0];
      const target = path.join(SITE, clean);
      const ok = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
      if (!ok) errors.push(`${rel}: broken internal link ${url}`);
    }
  }
  if (!affiliatesEnabled && />Where to buy</.test(html)) errors.push(`${rel}: where-to-buy block rendered while affiliates_enabled is false`);

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || "";
  const description = meta(html, "name", "description");
  if (!title) errors.push(`${rel}: missing title`);
  else if (titles.has(title)) errors.push(`${rel}: duplicate title also used by ${titles.get(title)}`);
  else titles.set(title, rel);
  if (!description) errors.push(`${rel}: missing meta description`);
  else if (descriptions.has(description)) errors.push(`${rel}: duplicate meta description also used by ${descriptions.get(description)}`);
  else descriptions.set(description, rel);
  if (!html.includes('rel="canonical"')) errors.push(`${rel}: missing canonical`);
  for (const key of ["og:title", "og:description", "og:url", "og:image", "og:type"]) {
    if (!meta(html, "property", key)) errors.push(`${rel}: missing ${key}`);
  }
  for (const key of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!meta(html, "name", key)) errors.push(`${rel}: missing ${key}`);
  }
  if (!html.includes('rel="preload"') || !html.includes('as="style"')) errors.push(`${rel}: missing critical CSS preload`);
  const og = meta(html, "property", "og:image");
  if (og.startsWith(site.url)) {
    const ogPath = og.slice(site.url.length).replace(/^\//, "").split(/[?#]/)[0];
    if (!fs.existsSync(path.join(SITE, ogPath))) errors.push(`${rel}: og:image file missing (${ogPath})`);
  }
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\swidth=/.test(img[0]) || !/\sheight=/.test(img[0])) errors.push(`${rel}: img missing width or height`);
  }
  const isDetail = /^(models|guides)\/[^/]+\/index\.html$/.test(rel);
  if (isDetail) {
    if (!html.includes('class="quick"')) errors.push(`${rel}: missing Quick answer block`);
    if (!html.includes("Last checked") || !/<time datetime="\d{4}-\d{2}-\d{2}"/.test(html)) errors.push(`${rel}: missing visible Last checked date`);
  }
  checkStructuredData(html, rel, errors);
}
if (!fs.existsSync(path.join(SITE, "pagefind", "pagefind-ui.js"))) errors.push("pagefind index missing (_site/pagefind)");

const cname = fs.existsSync(path.join(SITE, "CNAME")) ? fs.readFileSync(path.join(SITE, "CNAME"), "utf8").trim() : "";
if (cname !== "smokealarmswap.com") errors.push(`_site/CNAME must contain smokealarmswap.com, got ${JSON.stringify(cname)}`);

const home = fs.existsSync(path.join(SITE, "index.html")) ? fs.readFileSync(path.join(SITE, "index.html"), "utf8") : "";
if (!home.includes("https://static.cloudflareinsights.com/beacon.min.js") || !home.includes("df3a3255aa02445e8729ecf3fed5b56a")) {
  errors.push("Cloudflare Web Analytics beacon missing from index.html");
}

for (const slug of ["kidde", "firex", "first-alert"]) {
  if (!fs.existsSync(path.join(SITE, "brands", slug, "index.html"))) errors.push(`missing brand hub /brands/${slug}/`);
}
for (const file of ["llms.txt", "llms-full.txt", "robots.txt", "sitemap.xml"]) {
  if (!fs.existsSync(path.join(SITE, file))) errors.push(`missing ${file}`);
}
const robots = fs.existsSync(path.join(SITE, "robots.txt")) ? fs.readFileSync(path.join(SITE, "robots.txt"), "utf8") : "";
for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
  if (!robots.includes(`User-agent: ${bot}`) || !robots.includes("Allow: /")) errors.push(`robots.txt does not allow ${bot}`);
}
if (!robots.includes(`${site.url}/llms.txt`) || !robots.includes(`${site.url}/llms-full.txt`)) {
  errors.push("robots.txt does not name llms.txt and llms-full.txt");
}
const sitemap = fs.existsSync(path.join(SITE, "sitemap.xml")) ? fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8") : "";
const locs = sitemap.match(/<loc>/g)?.length || 0;
const lastmods = sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length || 0;
if (!locs || locs !== lastmods) errors.push(`sitemap.xml needs a YYYY-MM-DD lastmod on every url (${locs} urls, ${lastmods} lastmods)`);
function locDate(xml, urlPath) {
  const exact = `${site.url}${urlPath}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<loc>${exact}</loc><lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod>`);
  return xml.match(re)?.[1] || "";
}
let newestDetail = "";
for (const m of sitemap.matchAll(/<loc>https:\/\/smokealarmswap\.com\/(?:models|guides)\/[^<]+\/<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)) {
  if (m[1] > newestDetail) newestDetail = m[1];
}
for (const urlPath of ["/", "/models/", "/guides/", "/brands/", "/llms.txt", "/llms-full.txt"]) {
  const found = locDate(sitemap, urlPath);
  if (!found) errors.push(`sitemap.xml missing ${urlPath}`);
  else if (newestDetail && found < newestDetail) errors.push(`sitemap lastmod for ${urlPath} (${found}) is older than the newest model or guide (${newestDetail})`);
}
const privacyHtml = fs.existsSync(path.join(SITE, "privacy/index.html")) ? fs.readFileSync(path.join(SITE, "privacy/index.html"), "utf8") : "";
const privacyShown = privacyHtml.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1] || "";
if (privacyShown && locDate(sitemap, "/privacy/") !== privacyShown) {
  errors.push(`privacy sitemap lastmod ${locDate(sitemap, "/privacy/")} does not match the visible date ${privacyShown}`);
}
const linkedFrom = [
  ["models/kidde-i12060/index.html", ["/guides/hardwired-smoke-alarm-chirping/", "/guides/mix-brands-interconnected-alarms/", "/guides/smoke-alarm-date-and-expiry/"]],
  ["guides/smoke-alarm-date-and-expiry/index.html", ["/guides/hardwired-smoke-alarm-chirping/", "/guides/mix-brands-interconnected-alarms/"]],
  ["guides/mix-brands-interconnected-alarms/index.html", ["/models/kidde-20sar/", "/models/kidde-p4010acsco/", "/guides/hardwired-smoke-alarm-chirping/"]],
];
for (const [file, hrefs] of linkedFrom) {
  const html = fs.existsSync(path.join(SITE, file)) ? fs.readFileSync(path.join(SITE, file), "utf8") : "";
  for (const href of hrefs) if (!html.includes(`href="${href}"`)) errors.push(`${file} does not link ${href}`);
}
const llms = fs.existsSync(path.join(SITE, "llms.txt")) ? fs.readFileSync(path.join(SITE, "llms.txt"), "utf8") : "";
const llmsFull = fs.existsSync(path.join(SITE, "llms-full.txt")) ? fs.readFileSync(path.join(SITE, "llms-full.txt"), "utf8") : "";
if (!llms.includes(`${site.url}/models/kidde-i12060/`)) errors.push("llms.txt is missing a model URL");
if (!llmsFull.includes("https://www.nfpa.org/") && !llmsFull.includes("https://www.kidde.com/")) errors.push("llms-full.txt is missing source URLs");
const searchJs = fs.existsSync(path.join(SITE, "assets/search.js")) ? fs.readFileSync(path.join(SITE, "assets/search.js"), "utf8") : "";
if (!searchJs.includes('params.get("q")')) errors.push("search.js does not read the ?q= SearchAction query");

if (errors.length) { console.error(`✗ Output check failed:\n  - ${errors.join("\n  - ")}`); process.exit(1); }
console.log(`✓ Output check passed: ${files.length} HTML pages, internal links OK, search index present, no affiliate links, structured data OK.`);
