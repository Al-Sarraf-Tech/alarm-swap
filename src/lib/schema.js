// Structured-data helpers shared by the templates. Answers are existing fact
// values (already our own words); this file only picks which fact answers which question.

export function guideFacts(guide) {
  const out = [...(guide?.facts || [])];
  for (const sec of guide?.sections || []) {
    out.push(...(sec.facts || []));
    for (const row of sec.rows || []) out.push(...(row.facts || []));
  }
  return out;
}

export function collectFacts(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (Array.isArray(node.sections)) return guideFacts(node);
  if (Array.isArray(node.facts) || Array.isArray(node.replacement)) {
    return [...(node.facts || []), ...(node.replacement || [])];
  }
  return [];
}

export function latestChecked(node) {
  let max = "";
  for (const f of collectFacts(node)) {
    const c = f && f.checked ? String(f.checked) : "";
    if (c > max) max = c;
  }
  return max;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function prettyDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return String(iso || "");
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function absUrl(site, path) {
  const base = String(site.url || "").replace(/\/$/, "");
  if (!path) return base + "/";
  if (/^https?:\/\//.test(path)) return path;
  return base + (path.startsWith("/") ? path : `/${path}`);
}

export function hubForBrand(hubs, brand) {
  return (hubs || []).find((h) => (h.match || []).includes(brand)) || null;
}

export function adapterTokens(model) {
  const text = collectFacts(model).map((f) => `${f.id || ""} ${f.value || ""}`).join("\n");
  const found = new Set();
  for (const id of ["20-9003", "ADK-12", "KA-B3"]) {
    if (text.includes(id)) found.add(id);
  }
  return [...found];
}

export function adapterPeers(model, models) {
  const mine = new Set(adapterTokens(model));
  if (!mine.size) return [];
  const peers = [];
  for (const other of Object.values(models || {})) {
    if (!other || other.slug === model.slug) continue;
    const shared = adapterTokens(other).filter((id) => mine.has(id));
    if (shared.length) peers.push({ model: other, adapters: shared });
  }
  peers.sort((a, b) => `${a.model.brand} ${a.model.model}`.localeCompare(`${b.model.brand} ${b.model.model}`));
  return peers;
}

function byId(facts) {
  return new Map(facts.filter((f) => f && f.id).map((f) => [f.id, f]));
}

export function modelFaqs(model) {
  const facts = byId(collectFacts(model));
  const specs = [
    ["date-location", `Where is the date on a ${model.brand} ${model.model}?`],
    ["lifespan", `When should a ${model.brand} ${model.model} be replaced?`],
    ["named-replacement", `What replaces the ${model.brand} ${model.model}?`],
    ["adapter", `Which adapter guide lists the ${model.brand} ${model.model}?`],
    // Adapter pages
    ["old-side", `Which old alarms does the ${model.brand} ${model.model} fit?`],
    ["no-co", `Can the ${model.brand} ${model.model} connect a carbon monoxide alarm?`],
    ["firex", `Does the ${model.brand} ${model.model} fit Firex wiring?`],
  ];
  return specs
    .filter(([id]) => facts.has(id))
    .map(([id, q]) => ({ q, facts: [facts.get(id)] }));
}

const GUIDE_QUESTIONS = {
  "nfpa-10": "When does NFPA say a smoke alarm has to be replaced?",
  "usfa-back": "Where do you look for a smoke alarm's manufacture date?",
  "nfpa-chirp": "What does chirping that continues after a new battery mean?",
  "xs-nodate": "What should you do if a smoke alarm shows no manufacture date?",
  "kidde-mixing": "Can you add any brand to a Kidde interconnect loop?",
};

export function guideFaqs(guide) {
  const facts = byId(guideFacts(guide));
  const items = [];
  const used = new Set();
  for (const [id, q] of Object.entries(GUIDE_QUESTIONS)) {
    if (!facts.has(id)) continue;
    items.push({ q, facts: [facts.get(id)] });
    used.add(id);
  }
  for (const sec of guide.sections || []) {
    const heading = (sec.heading || "").trim();
    if (!heading.endsWith("?")) continue;
    const secFacts = (sec.facts || []).filter((f) => f && !used.has(f.id));
    if (!secFacts.length) continue;
    items.push({ q: heading, facts: secFacts });
    for (const f of secFacts) used.add(f.id);
  }
  return items;
}

const HOWTO = [
  ["Turn off power before you take a hardwired alarm down", "kidde-power-off"],
  ["Read the manufacture date on the alarm", "usfa-back"],
  ["Count the years from that date", "nfpa-10"],
  ["If the date is missing, replace the alarm", "xs-nodate"],
  ["On an interconnected loop, stay with models the maker lists", "kidde-mixing"],
];

export function howToSteps(guide) {
  if (guide?.slug !== "smoke-alarm-date-and-expiry") return [];
  const facts = byId(guideFacts(guide));
  return HOWTO
    .filter(([, id]) => facts.has(id))
    .map(([name, id], i) => ({ name, fact: facts.get(id), position: i + 1 }));
}

export function hubFacts(hub, models, guides) {
  const match = new Set(hub.match || []);
  const facts = [];
  for (const model of Object.values(models || {})) {
    if (match.has(model.brand)) facts.push(...collectFacts(model));
  }
  for (const guide of Object.values(guides || {})) {
    for (const sec of guide.sections || []) {
      for (const row of sec.rows || []) {
        if (match.has(row.brand)) facts.push(...(row.facts || []));
      }
    }
  }
  return facts;
}

function crumbList(site, crumbs, pageUrl) {
  const canon = absUrl(site, pageUrl);
  return {
    "@type": "BreadcrumbList",
    "@id": `${canon}#breadcrumbs`,
    itemListElement: (crumbs || []).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url ? absUrl(site, c.url) : canon,
    })),
  };
}

function faqNode(pageUrl, faqs) {
  if (!faqs?.length) return null;
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.facts.map((f) => f.value).join(" "),
      },
    })),
  };
}

function articleNode(site, pageUrl, title, description, published, modified, imagePath) {
  return {
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: title,
    description,
    datePublished: published,
    dateModified: modified || published,
    inLanguage: "en",
    mainEntityOfPage: pageUrl,
    author: { "@id": `${absUrl(site, "/")}#organization` },
    publisher: { "@id": `${absUrl(site, "/")}#organization` },
    image: absUrl(site, imagePath),
  };
}

export function pageSchema(site, crumbs, title, description, pageUrl, model, guide, hub) {
  const url = absUrl(site, pageUrl);
  const orgId = `${absUrl(site, "/")}#organization`;
  const webId = `${absUrl(site, "/")}#website`;
  const graph = [
    {
      "@type": "Organization",
      "@id": orgId,
      name: site.name,
      url: absUrl(site, "/"),
      description: site.description,
      logo: {
        "@type": "ImageObject",
        url: absUrl(site, "/assets/logo.svg"),
        width: 64,
        height: 64,
      },
      sameAs: site.repo ? [site.repo] : undefined,
    },
    {
      "@type": "WebSite",
      "@id": webId,
      name: site.name,
      url: absUrl(site, "/"),
      description: site.description,
      inLanguage: "en",
      publisher: { "@id": orgId },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${absUrl(site, "/")}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    crumbList(site, crumbs, pageUrl),
  ];

  if (model?.slug && Array.isArray(model.facts)) {
    const modified = latestChecked(model);
    const faqs = modelFaqs(model);
    graph.push(articleNode(site, url, model.title, model.description, model.published, modified, `/og/models/${model.slug}.svg`));
    const product = {
      "@type": "Product",
      "@id": `${url}#product`,
      name: `${model.brand} ${model.model}`,
      description: model.description,
      brand: { "@type": "Brand", name: model.brand },
      model: model.model,
      category: model.kind,
      url,
    };
    const part = (model.facts || []).find((f) => f.id === "part-number");
    if (part?.value) product.sku = String(part.value);
    graph.push(product);
    const faq = faqNode(url, faqs);
    if (faq) graph.push(faq);
  }

  if (guide?.slug && Array.isArray(guide.sections)) {
    const modified = latestChecked(guide);
    graph.push(articleNode(site, url, guide.title, guide.description, guide.published, modified, `/og/guides/${guide.slug}.svg`));
    const steps = howToSteps(guide);
    if (steps.length) {
      graph.push({
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: guide.title,
        description: guide.description,
        step: steps.map((s) => ({
          "@type": "HowToStep",
          position: s.position,
          name: s.name,
          text: s.fact.value,
          url: `${url}#howto-${s.position}`,
        })),
      });
    }
    const faq = faqNode(url, guideFaqs(guide));
    if (faq) graph.push(faq);
  }

  if (hub?.slug) {
    graph.push({
      "@type": "CollectionPage",
      "@id": `${url}#collection`,
      name: hub.title,
      description: hub.description,
      url,
      isPartOf: { "@id": webId },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function jsonld(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
