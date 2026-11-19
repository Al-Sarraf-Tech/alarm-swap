#!/usr/bin/env node
// Post-build gate: internal links resolve, search index exists, Amazon links match the offer list,
// and JSON-LD parses with the fields each page type requires.
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { checkStructuredData } from "./check-schema.mjs";
import { amazonHref, offersFor } from "../src/lib/amazon.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = path.join(ROOT, "_site");
const PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/?$/, "/");
const AFF = /([?&](tag|aff|affid|aff_id|affiliate|irclickid|clickid|ref_)=)|amzn\.to|sjv\.io|shareasale|awin1\.com|anrdoezrs|dpbolvw|jdoqocy|kqzyfj|tkqlhce|linksynergy/i;
// Cookie-free Cloudflare Web Analytics in the base layout. Not an affiliate link.
const NON_AFFILIATE_HOSTS = new Set(["static.cloudflareinsights.com"]);
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/site.json"), "utf8"));
const affiliatesEnabled = site.affiliates_enabled === true;
const catalogModels = {};
for (const name of fs.readdirSync(path.join(ROOT, "src/_data/models")).filter((n) => n.endsWith(".yaml"))) {
  const doc = yaml.load(fs.readFileSync(path.join(ROOT, "src/_data/models", name), "utf8"), { schema: yaml.CORE_SCHEMA });
  if (doc?.slug) catalogModels[doc.slug] = doc;
}
const IMPACT_META = "<meta name='impact-site-verification' value='f7c5a118-9b24-47ab-9555-7d703204ec87'>";

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
  if (/m\.media-amazon\.com|images-na\.ssl-images-amazon|amzn\.to/i.test(html)) {
    errors.push(`${rel}: Amazon image host or shortened affiliate link`);
  }
  const relPosix = rel.split(path.sep).join("/");
  const pageMatch = relPosix.match(/^(?:models|guides)\/([^/]+)\/index\.html$/);
  const expectedUrls = affiliatesEnabled && pageMatch ? offersFor(pageMatch[1], catalogModels).map((offer) => amazonHref(offer, site.amazon_tag)) : [];
  const seenAmazon = [];
  for (const link of html.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>/g)) {
    const raw = link[1].replace(/&amp;/g, "&").replace(/&#38;/g, "&");
    if (/amazon\.com|amzn\.to/i.test(raw)) seenAmazon.push({ raw, tag: link[0] });
  }
  if (!affiliatesEnabled && seenAmazon.length) errors.push(`${rel}: Amazon link rendered while affiliates_enabled is false`);
  if (affiliatesEnabled) {
    if (seenAmazon.length !== expectedUrls.length) {
      errors.push(`${rel}: expected ${expectedUrls.length} Amazon links, found ${seenAmazon.length}`);
    }
    const expectedCounts = new Map();
    for (const url of expectedUrls) expectedCounts.set(url, (expectedCounts.get(url) || 0) + 1);
    for (const [url, n] of expectedCounts) {
      const href = url.replace(/&/g, "&amp;");
      const anchor = `<a href="${href}" rel="sponsored nofollow noopener" target="_blank">Check price on Amazon</a>`;
      const found = html.split(anchor).length - 1;
      if (found !== n) errors.push(`${rel}: Amazon link for ${url} appeared ${found} times, expected ${n}`);
      let parsed = null;
      try { parsed = new URL(url); } catch { /* recorded below */ }
      if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== "www.amazon.com") {
        errors.push(`${rel}: Amazon link is not a direct https://www.amazon.com URL: ${url}`);
      } else if (parsed.searchParams.get("tag") !== site.amazon_tag) {
        errors.push(`${rel}: Amazon link tag is not ${site.amazon_tag}: ${url}`);
      } else {
        const dp = /^\/dp\/([A-Z0-9]{10})$/.test(parsed.pathname);
        const search = parsed.pathname === "/s" && parsed.searchParams.get("k");
        if (!dp && !search) errors.push(`${rel}: Amazon link is not a /dp/ ASIN or a search URL: ${url}`);
        const allowed = new Set(dp ? ["tag"] : ["k", "tag"]);
        for (const key of parsed.searchParams.keys()) {
          if (!allowed.has(key)) errors.push(`${rel}: unexpected Amazon query parameter ${key} on ${url}`);
        }
      }
    }
    for (const found of seenAmazon) {
      if (!expectedUrls.includes(found.raw)) errors.push(`${rel}: unexpected Amazon link ${found.raw}`);
      if (!/\srel="sponsored nofollow noopener"/.test(found.tag) || !/\starget="_blank"/.test(found.tag)) {
        errors.push(`${rel}: Amazon link missing rel="sponsored nofollow noopener" or target="_blank": ${found.raw}`);
      }
    }
    if (expectedUrls.length && !html.includes("As an Amazon Associate I earn from qualifying purchases.")) {
      errors.push(`${rel}: Amazon links without the associate disclosure sentence`);
    }
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
  if (!html.includes('href="/affiliate-disclosure/"') || !html.includes('href="/privacy/"')) {
    errors.push(`${rel}: footer missing affiliate disclosure or privacy link`);
  }
  const isCommercePage = /^(models|guides|brands)\/[^/]+\/index\.html$/.test(rel);
  const hasNotice = html.includes('class="affiliate-notice"');
  if (isCommercePage && affiliatesEnabled && !hasNotice) errors.push(`${rel}: affiliate notice missing while affiliates_enabled is true`);
  if (isCommercePage && !affiliatesEnabled && hasNotice) errors.push(`${rel}: affiliate notice rendered while affiliates_enabled is false`);

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
if (!privacyHtml.includes("It is cookieless and doesn't track individuals.")) errors.push("privacy page does not say Cloudflare Web Analytics is cookieless and doesn't track individuals");
if (!privacyHtml.includes("The site itself sets no cookies.")) errors.push("privacy page does not say the site itself sets no cookies");
if (!privacyHtml.includes("If you click an outbound retailer or affiliate link, that retailer (for example Amazon or Walmart) or its affiliate network may set its own cookies to credit the referral, under that retailer's own privacy policy.")) {
  errors.push("privacy page is missing the outbound retailer cookie sentence");
}
const disclosureHtml = fs.existsSync(path.join(SITE, "affiliate-disclosure/index.html")) ? fs.readFileSync(path.join(SITE, "affiliate-disclosure/index.html"), "utf8") : "";
if (!disclosureHtml) errors.push("missing /affiliate-disclosure/");
for (const sentence of [
  "Some links on this site may be affiliate links.",
  "If you buy through them, the site may earn a commission, at no extra cost to you.",
  "This never changes which alarm a page recommends, because recommendations come from manufacturer compatibility information.",
  "As an Amazon Associate I earn from qualifying purchases.",
  "Retailer partners may include Amazon, Walmart, Ace Hardware, Home Depot, and X-Sense.",
]) {
  if (!disclosureHtml.includes(sentence)) errors.push(`affiliate disclosure missing: ${sentence}`);
}
if (!locDate(sitemap, "/affiliate-disclosure/")) errors.push("sitemap.xml missing /affiliate-disclosure/");
const noticeSrc = fs.readFileSync(path.join(ROOT, "src/_includes/partials/affiliate-notice.njk"), "utf8");
if (!noticeSrc.includes("site.affiliates_enabled")) errors.push("affiliate notice is not wired to affiliates_enabled");
if (!noticeSrc.includes("<a href=\"/affiliate-disclosure/\">As an Amazon Associate I earn from qualifying purchases.</a>")) {
  errors.push("affiliate notice text does not match the required one-line disclosure");
}
for (const tpl of ["src/models/model.njk", "src/guides/guide.njk", "src/brands/brand.njk"]) {
  const src = fs.readFileSync(path.join(ROOT, tpl), "utf8");
  if (!src.includes('partials/affiliate-notice.njk')) errors.push(`${tpl} does not include the affiliate notice`);
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
for (const [name, text] of [["llms.txt", llms], ["llms-full.txt", llmsFull]]) {
  if (/amazon\.com|amzn\.to|\?tag=/i.test(text)) errors.push(`${name} must not contain an Amazon or affiliate link`);
}
const homeHead = home.split("</head>")[0] || "";
if (!homeHead.includes(IMPACT_META)) errors.push("homepage head is missing the Impact site verification meta");
const searchJs = fs.existsSync(path.join(SITE, "assets/search.js")) ? fs.readFileSync(path.join(SITE, "assets/search.js"), "utf8") : "";
if (!searchJs.includes('params.get("q")')) errors.push("search.js does not read the ?q= SearchAction query");

if (errors.length) { console.error(`✗ Output check failed:\n  - ${errors.join("\n  - ")}`); process.exit(1); }
const affiliateNote = affiliatesEnabled ? "Amazon links checked" : "no affiliate links";
console.log(`✓ Output check passed: ${files.length} HTML pages, internal links OK, search index present, ${affiliateNote}, structured data OK.`);
