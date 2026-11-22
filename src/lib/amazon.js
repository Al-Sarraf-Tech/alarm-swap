// Amazon Associates links. The tracking id lives only in src/_data/site.json
// (`amazon_tag`). This file says which already-named product gets one link on
// which page, and the ASIN only when an Amazon product page was opened and its
// model number plus a count of 1 matched that exact model.
// No prices, star ratings, or product images are stored here.

const ASIN = /^[A-Z0-9]{10}$/;
const TAG = /^[A-Za-z0-9_-]+$/;

// Verified 2026-11-19 against the Amazon product page (model number, count of 1).
// Voice variants and multipacks were not used.
const asins = {
  "kidde-20sa10": "B0CX6BTBWL",
  "kidde-20sar": "B0CX6C1JHJ",
  "kidde-30cua10": "B0CX6FVG83",
  "kidde-20-9003": "B0D5TD3GJF",
  "first-alert-smi100-ac": "B0CJMN3443",
};

// Named on a page, but there is no model file for it.
const extras = {
  "kidde-ka-b3": { brand: "Kidde", model: "KA-B3" },
  "first-alert-smico105-ac": { brand: "First Alert", model: "SMICO105-AC" },
};

// One entry per recommended model. A model that is only the subject of a
// troubleshooting page is not listed.
const pages = {
  "firex-i4618": ["kidde-20sar", "kidde-20-9003"],
  "first-alert-9120b": ["first-alert-smi100-ac"],
  "first-alert-adf": ["first-alert-adf", "kidde-20sar", "first-alert-adk-12"],
  "first-alert-adk-12": ["first-alert-adk-12", "first-alert-adf", "kidde-20-9003"],
  "first-alert-smi100-ac": ["first-alert-smi100-ac"],
  "first-alert-smi105-ac": ["first-alert-smi105-ac"],
  "first-alert-sm100v-ac": ["first-alert-sm100v-ac"],
  "first-alert-smco100v-ac": ["first-alert-smco100v-ac"],
  "first-alert-smico100-ac": ["first-alert-smico100-ac"],
  "kidde-20-9003": ["kidde-20-9003", "kidde-ka-b3", "first-alert-adk-12"],
  "kidde-20sa10": ["kidde-20sa10"],
  "kidde-20sar": ["kidde-20sar"],
  "kidde-30cua10": ["kidde-30cua10"],
  "kidde-30cuar": ["kidde-30cuar"],
  "kidde-i12010s": ["kidde-20sa10"],
  "kidde-i12040": ["kidde-20-9003"],
  "kidde-i12060": ["kidde-20-9003"],
  "kidde-kn-cosm-iba": ["kidde-30cuar", "kidde-20-9003"],
  "kidde-p4010acsco": ["kidde-30cua10"],
  "kidde-20sa10-vs-20sar-vs-30cua10": ["kidde-20sa10", "kidde-20sar", "kidde-30cua10"],
  "old-smoke-alarm-plug-fit": ["kidde-20-9003", "kidde-ka-b3", "first-alert-adk-12", "first-alert-adf"],
  "first-alert-sc9120b-sc9120lbl-replacement": ["first-alert-smico100-ac", "first-alert-smico105-ac"],
  "firex-i4618ac-replacement": ["kidde-20sar", "kidde-20-9003", "first-alert-adf"],
  "mix-brands-interconnected-alarms": ["kidde-20-9003", "kidde-ka-b3"],
};

export function offersFor(slug, models) {
  const ids = pages[slug] || [];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const extra = extras[id];
    const model = models && models[id];
    const brand = extra?.brand || model?.brand;
    const name = extra?.model || model?.model;
    if (!brand || !name) {
      throw new Error(`Amazon offers: ${slug} lists ${id}, which is not a model page or a known extra`);
    }
    const asin = asins[id] || "";
    if (asin && !ASIN.test(asin)) throw new Error(`Amazon offers: bad ASIN for ${id}`);
    out.push({ id, brand, model: name, asin });
  }
  return out;
}

export function amazonHref(offer, tag) {
  const raw = String(tag || "").trim();
  if (!TAG.test(raw)) throw new Error("site.amazon_tag is missing or not a plain tracking id");
  const tracked = encodeURIComponent(raw);
  if (offer.asin) {
    if (!ASIN.test(offer.asin)) throw new Error(`Amazon offers: bad ASIN for ${offer.brand} ${offer.model}`);
    return `https://www.amazon.com/dp/${offer.asin}?tag=${tracked}`;
  }
  const q = encodeURIComponent(`${offer.brand} ${offer.model}`.replace(/\s+/g, " ").trim()).replace(/%20/g, "+");
  return `https://www.amazon.com/s?k=${q}&tag=${tracked}`;
}
