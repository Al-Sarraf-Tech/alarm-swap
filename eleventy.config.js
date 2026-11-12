import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as yaml from "js-yaml";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import {
  absUrl,
  adapterPeers,
  guideFacts,
  guideFaqs,
  howToSteps,
  hubFacts,
  hubForBrand,
  jsonld,
  latestChecked,
  modelFaqs,
  pageSchema,
  prettyDate,
} from "./src/lib/schema.js";
import { writeOgImages } from "./src/lib/og.js";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const cssHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "src/assets/style.css"))).digest("hex").slice(0, 8);
const hubs = yaml.load(fs.readFileSync(path.join(ROOT, "src/_data/brandHubs.yaml"), "utf8"), { schema: yaml.CORE_SCHEMA });

export default function (eleventyConfig) {
  // CORE_SCHEMA keeps dates like 2026-10-31 as plain strings (no timezone surprises).
  eleventyConfig.addDataExtension("yaml,yml", (contents) => yaml.load(contents, { schema: yaml.CORE_SCHEMA }));

  // Rewrites root-relative URLs when PATH_PREFIX is not "/".
  // Production is the custom domain root (https://smokealarmswap.com/).
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // GitHub Pages reads this from the published site and serves the custom domain.
  eleventyConfig.addPassthroughCopy({ CNAME: "CNAME" });
  // IndexNow key file: public/<key>.txt is served at the site root (the key is public by design).
  eleventyConfig.addPassthroughCopy({ public: "." });

  eleventyConfig.addGlobalData("cssFile", `/assets/style.${cssHash}.css`);

  eleventyConfig.addFilter("sourcesFor", (facts = []) => {
    const seen = new Map();
    for (const f of facts) {
      if (!seen.has(f.source_url)) {
        seen.set(f.source_url, {
          n: seen.size + 1,
          url: f.source_url,
          title: f.source_title,
          checked: f.checked,
        });
      } else if (f.checked > seen.get(f.source_url).checked) {
        seen.get(f.source_url).checked = f.checked;
      }
    }
    return [...seen.values()];
  });

  eleventyConfig.addFilter("citeNum", (fact, sources) => {
    const s = sources.find((x) => x.url === fact.source_url);
    return s ? s.n : "?";
  });

  eleventyConfig.addFilter("guideFacts", guideFacts);
  eleventyConfig.addFilter("factById", (facts, id) => facts.find((f) => f.id === id));
  eleventyConfig.addFilter("byPublished", (obj = {}) =>
    Object.values(obj).sort((a, b) => String(a.published).localeCompare(String(b.published)))
  );
  eleventyConfig.addFilter("isoDate", (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d)));
  eleventyConfig.addFilter("latestChecked", latestChecked);
  eleventyConfig.addFilter("prettyDate", prettyDate);
  eleventyConfig.addFilter("hubFor", (brand) => hubForBrand(hubs, brand));
  eleventyConfig.addFilter("modelFaqs", modelFaqs);
  eleventyConfig.addFilter("guideFaqs", guideFaqs);
  eleventyConfig.addFilter("howToSteps", howToSteps);
  eleventyConfig.addFilter("adapterPeers", adapterPeers);
  eleventyConfig.addFilter("hubChecked", (hub, models, guides) => latestChecked(hubFacts(hub, models, guides)));
  eleventyConfig.addFilter("factsFromRows", (rows = []) => rows.flatMap((item) => item.row?.facts || []));
  eleventyConfig.addFilter("modelsForHub", (models, hub) => {
    const match = new Set(hub.match || []);
    return Object.values(models || {}).filter((m) => match.has(m.brand)).sort((a, b) => String(a.model).localeCompare(String(b.model)));
  });
  eleventyConfig.addFilter("guideRowsForHub", (guides, hub) => {
    const match = new Set(hub.match || []);
    const rows = [];
    for (const guide of Object.values(guides || {})) {
      for (const sec of guide.sections || []) {
        for (const row of sec.rows || []) {
          if (match.has(row.brand)) rows.push({ guide, row });
        }
      }
    }
    return rows;
  });
  eleventyConfig.addFilter("pageSchema", pageSchema);
  eleventyConfig.addFilter("jsonld", jsonld);
  eleventyConfig.addFilter("absUrl", absUrl);
  function contentLastmod(models, guides) {
    let max = "";
    for (const node of [...Object.values(models || {}), ...Object.values(guides || {})]) {
      const checked = latestChecked(node);
      if (checked > max) max = checked;
    }
    return max || "2026-10-31";
  }

  eleventyConfig.addFilter("contentLastmod", contentLastmod);
  eleventyConfig.addFilter("pageLastmod", (page, models, guides) => {
    if (page?.data?.m?.facts) return latestChecked(page.data.m);
    if (page?.data?.g?.sections) {
      const checked = latestChecked(page.data.g);
      const updated = page.data.g.updated ? String(page.data.g.updated) : "";
      return updated > checked ? updated : checked;
    }
    if (page?.data?.hub) return latestChecked(hubFacts(page.data.hub, models, guides)) || "2026-10-31";
    const url = page?.url || "";
    if (url === "/" || url === "/models/" || url === "/guides/" || url === "/brands/") return contentLastmod(models, guides);
    if (page?.data?.updated) return String(page.data.updated);
    return "2026-10-31";
  });

  eleventyConfig.on("eleventy.after", (arg) => {
    const siteDir = typeof arg === "string" ? arg : arg.dir.output;
    const css = path.join(siteDir, "assets/style.css");
    if (fs.existsSync(css)) fs.copyFileSync(css, path.join(siteDir, `assets/style.${cssHash}.css`));
    writeOgImages(ROOT, siteDir);
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
