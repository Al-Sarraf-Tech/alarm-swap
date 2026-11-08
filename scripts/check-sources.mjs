#!/usr/bin/env node
// Build gate: every fact in src/_data/{models,guides}/*.yaml must carry
// source_url + source_title + checked, from an allowed source. Exits 1 on any problem.
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIRS = ["src/_data/models", "src/_data/guides"];

// Only makers, NFPA, USFA and CPSC. Add a maker's domain here when you add its first page.
const ALLOWED_HOSTS = [
  "kidde.com", "kiddecanada.com",
  "firstalert.com", "brkelectronics.com", "resideo.com",
  "support.google.com",
  "x-sense.com",
  "universalsecurity.com",
  "nfpa.org", "usfa.fema.gov", "cpsc.gov", "saferproducts.gov",
];
const FACT_ARRAYS = new Set(["facts", "replacement"]);
const AFFILIATE_HINTS = /([?&](tag|aff|affid|aff_id|affiliate|irclickid|clickid|ref_)=)|amzn\.to|sjv\.io|shareasale|awin1\.com|anrdoezrs|dpbolvw|jdoqocy|kqzyfj|tkqlhce|impact\.com\/campaign|linksynergy/i;
// This script only reads fact YAML. The cookie-free Cloudflare Web Analytics beacon
// (static.cloudflareinsights.com, in the base layout) is not a fact source and is not an affiliate link.
const today = new Date().toISOString().slice(0, 10);

const errors = [];
let factCount = 0;
const slugs = { models: new Set(), guides: new Set() };
const refs = []; // [file, kind, slug]

function err(file, where, msg) { errors.push(`${file}${where ? ` @ ${where}` : ""}: ${msg}`); }

function hostAllowed(u) {
  const h = u.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

function checkFact(file, where, f, ids) {
  factCount++;
  if (!f || typeof f !== "object") return err(file, where, "fact is not an object");
  for (const k of ["id", "value", "source_url", "source_title", "checked"]) {
    if (f[k] === undefined || f[k] === null || String(f[k]).trim() === "") err(file, where, `missing ${k}`);
  }
  if (f.id) {
    if (ids.has(f.id)) err(file, where, `duplicate fact id "${f.id}"`);
    ids.add(f.id);
  }
  if (f.source_url) {
    let u;
    try { u = new URL(f.source_url); } catch { err(file, where, `source_url is not a URL: ${f.source_url}`); }
    if (u) {
      if (u.protocol !== "https:") err(file, where, `source_url must be https: ${f.source_url}`);
      if (!hostAllowed(u)) err(file, where, `source host not allowed (${u.hostname}). Only makers, NFPA, USFA, CPSC.`);
    }
  }
  if (f.checked !== undefined) {
    const c = String(f.checked);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c) || isNaN(Date.parse(c + "T00:00:00Z"))) err(file, where, `checked must be YYYY-MM-DD (quoted), got "${c}"`);
    else if (c > today) err(file, where, `checked date ${c} is in the future`);
  }
}

function walk(file, node, where, ids) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => walk(file, x, `${where}[${i}]`, ids));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      const w = where ? `${where}.${k}` : k;
      if (k === "where_to_buy") {
        // Optional store links. Not facts, and not rendered while affiliates_enabled is false.
        // The output check is what blocks them from the HTML until that flag is on.
        if (!Array.isArray(v)) { err(file, w, "where_to_buy must be a list"); continue; }
        v.forEach((link, i) => {
          const lw = `${w}[${i}]`;
          if (!link || typeof link !== "object") return err(file, lw, "where_to_buy entry must be an object");
          if (!link.label && !link.retailer) err(file, lw, "where_to_buy needs a label");
          if (!link.url) err(file, lw, "where_to_buy needs a url");
          else {
            try {
              const u = new URL(link.url);
              if (u.protocol !== "https:") err(file, lw, "where_to_buy url must be https");
            } catch { err(file, lw, "where_to_buy url is not a URL"); }
          }
        });
        continue;
      }
      if (FACT_ARRAYS.has(k)) {
        if (!Array.isArray(v)) { err(file, w, `${k} must be a list`); continue; }
        v.forEach((f, i) => checkFact(file, `${w}[${i}]`, f, ids));
      } else {
        walk(file, v, w, ids);
      }
    }
  } else if (typeof node === "string" && AFFILIATE_HINTS.test(node)) {
    err(file, where, "looks like an affiliate link; affiliate links are not allowed yet");
  }
}

for (const dir of DATA_DIRS) {
  const kind = path.basename(dir);
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const file = path.join(dir, name);
    let doc;
    try { doc = yaml.load(fs.readFileSync(path.join(abs, name), "utf8"), { schema: yaml.CORE_SCHEMA }); }
    catch (e) { err(file, "", `YAML parse error: ${e.message}`); continue; }
    const base = name.replace(/\.ya?ml$/, "");
    for (const k of ["slug", "title", "description", "published"]) if (!doc?.[k]) err(file, k, "required");
    if (doc?.slug && doc.slug !== base) err(file, "slug", `slug "${doc.slug}" must match file name "${base}"`);
    if (doc?.published && !/^\d{4}-\d{2}-\d{2}$/.test(String(doc.published))) err(file, "published", "must be quoted YYYY-MM-DD");
    if (kind === "models") {
      for (const k of ["brand", "model", "kind", "summary"]) if (!doc?.[k]) err(file, k, "required");
      if (!Array.isArray(doc?.facts) || doc.facts.length < 3) err(file, "facts", "a model page needs at least 3 sourced facts");
      if (!Array.isArray(doc?.replacement) || doc.replacement.length < 1) err(file, "replacement", "a model page needs at least 1 sourced replacement fact");
      (doc?.related || []).forEach((s) => refs.push([file, "models", s]));
    } else {
      if (!Array.isArray(doc?.sections) || !doc.sections.length) err(file, "sections", "a guide needs sections");
      (doc?.sections || []).forEach((s) => (s.rows || []).forEach((r) => (r.models || []).forEach((m) => refs.push([file, "models", m]))));
      (doc?.related_guides || []).forEach((s) => refs.push([file, "guides", s]));
    }
    if (doc?.slug) slugs[kind].add(doc.slug);
    walk(file, doc, "", new Set());
  }
}
for (const [file, kind, s] of refs) if (!slugs[kind].has(s)) err(file, "", `links to ${kind}/${s}, which does not exist`);

if (errors.length) {
  console.error(`✗ Source check failed (${errors.length} problem${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ Source check passed: ${factCount} facts across ${slugs.models.size} models and ${slugs.guides.size} guides, all sourced.`);
