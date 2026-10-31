import * as yaml from "js-yaml";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // YAML data files (src/_data/**/*.yaml)
  // CORE_SCHEMA keeps dates like 2026-10-31 as plain strings (no timezone surprises).
  eleventyConfig.addDataExtension("yaml,yml", (contents) => yaml.load(contents, { schema: yaml.CORE_SCHEMA }));

  // Rewrites root-relative URLs when PATH_PREFIX is not "/".
  // Production is the custom domain root (https://smokealarmswap.com/).
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // GitHub Pages reads this from the published site and serves the custom domain.
  eleventyConfig.addPassthroughCopy({ CNAME: "CNAME" });

  // Unique list of sources (in first-cited order) for a list of facts.
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

  // Citation number of a fact within a page's source list.
  eleventyConfig.addFilter("citeNum", (fact, sources) => {
    const s = sources.find((x) => x.url === fact.source_url);
    return s ? s.n : "?";
  });

  // All facts on a guide page (flattens sections → rows → facts).
  eleventyConfig.addFilter("guideFacts", (guide) => {
    const out = [...(guide.facts || [])];
    for (const sec of guide.sections || []) {
      out.push(...(sec.facts || []));
      for (const row of sec.rows || []) out.push(...(row.facts || []));
    }
    return out;
  });

  eleventyConfig.addFilter("factById", (facts, id) => facts.find((f) => f.id === id));

  // Turn the models/guides data objects into arrays sorted by publish date.
  eleventyConfig.addFilter("byPublished", (obj = {}) =>
    Object.values(obj).sort((a, b) => String(a.published).localeCompare(String(b.published)))
  );

  eleventyConfig.addFilter("isoDate", (d) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d)
  );

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
