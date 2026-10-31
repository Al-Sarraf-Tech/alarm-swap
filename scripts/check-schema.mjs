// Confirms JSON-LD parses and matches visible copy. Ratings are never allowed.

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ");
}

function contentAppears(hay, needle) {
  const parts = String(needle).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 15);
  const checks = parts.length ? parts : [String(needle).trim()];
  return checks.every((p) => hay.includes(p));
}

function nodesOf(value, nodes, errors, rel) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v) => nodesOf(v, nodes, errors, rel));
    return;
  }
  for (const key of Object.keys(value)) {
    if (key === "aggregateRating" || key === "review" || key === "reviewCount" || key === "ratingValue") {
      errors.push(`${rel}: structured data must not include ${key}`);
    }
  }
  if (value["@type"]) nodes.push(value);
  for (const val of Object.values(value)) nodesOf(val, nodes, errors, rel);
}

function ofType(nodes, type) {
  return nodes.filter((n) => [].concat(n["@type"] || []).includes(type));
}

export function checkStructuredData(html, rel, errors) {
  const blocks = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { blocks.push(JSON.parse(m[1])); }
    catch (e) { errors.push(`${rel}: JSON-LD did not parse: ${e.message}`); return; }
  }
  if (!blocks.length) { errors.push(`${rel}: missing JSON-LD`); return; }

  const nodes = [];
  for (const block of blocks) nodesOf(block, nodes, errors, rel);
  const need = (type, fields) => {
    const node = ofType(nodes, type)[0];
    if (!node) { errors.push(`${rel}: missing ${type}`); return null; }
    for (const field of fields) {
      if (node[field] === undefined || node[field] === null || node[field] === "") errors.push(`${rel}: ${type} missing ${field}`);
    }
    return node;
  };

  need("Organization", ["name", "url"]);
  const website = need("WebSite", ["name", "url", "potentialAction"]);
  if (website?.potentialAction) {
    const action = website.potentialAction;
    if (![].concat(action["@type"] || []).includes("SearchAction")) errors.push(`${rel}: WebSite potentialAction must be a SearchAction`);
    const target = action.target && typeof action.target === "object" ? action.target.urlTemplate : action.target;
    if (!String(target || "").includes("{search_term_string}")) errors.push(`${rel}: SearchAction target missing {search_term_string}`);
    if (!String(action["query-input"] || "").includes("search_term_string")) errors.push(`${rel}: SearchAction missing query-input`);
  }
  const crumbs = need("BreadcrumbList", ["itemListElement"]);
  if (crumbs && (!Array.isArray(crumbs.itemListElement) || !crumbs.itemListElement.length)) {
    errors.push(`${rel}: BreadcrumbList needs at least one item`);
  } else if (crumbs) {
    crumbs.itemListElement.forEach((item, i) => {
      if (!item.name || !item.item) errors.push(`${rel}: breadcrumb ${i + 1} missing name or item`);
    });
  }

  const text = htmlToText(html);
  const isModel = /^models\/[^/]+\/index\.html$/.test(rel);
  const isGuide = /^guides\/[^/]+\/index\.html$/.test(rel);
  const isDateGuide = rel === "guides/smoke-alarm-date-and-expiry/index.html";

  if (isModel || isGuide) {
    const article = need("Article", ["headline", "datePublished", "dateModified", "mainEntityOfPage"]);
    if (article) {
      for (const field of ["datePublished", "dateModified"]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(article[field]))) errors.push(`${rel}: Article ${field} must be YYYY-MM-DD`);
      }
    }
    const faq = ofType(nodes, "FAQPage")[0];
    if (!faq) errors.push(`${rel}: missing FAQPage`);
    else if (!Array.isArray(faq.mainEntity) || !faq.mainEntity.length) errors.push(`${rel}: FAQPage mainEntity is empty`);
    else {
      for (const q of faq.mainEntity) {
        if (!q.name) errors.push(`${rel}: FAQ question missing a name`);
        else if (!text.includes(q.name)) errors.push(`${rel}: FAQ question is not visible: ${q.name}`);
        const answer = q.acceptedAnswer?.text || "";
        if (!answer) errors.push(`${rel}: FAQ answer is empty`);
        else if (!contentAppears(text, answer)) errors.push(`${rel}: FAQ answer is not visible: ${answer.slice(0, 90)}`);
      }
    }
  }

  if (isModel) {
    const product = need("Product", ["name", "url"]);
    if (product && (product.aggregateRating || product.review)) errors.push(`${rel}: Product must not include a rating or a review`);
    if (product?.brand && !product.brand.name) errors.push(`${rel}: Product brand missing name`);
  }

  if (isDateGuide) {
    const howto = need("HowTo", ["name", "step"]);
    if (howto && (!Array.isArray(howto.step) || howto.step.length < 3)) errors.push(`${rel}: HowTo needs at least 3 steps`);
    for (const step of howto?.step || []) {
      if (!step.name || !step.text) errors.push(`${rel}: HowTo step missing name or text`);
      if (step.name && !text.includes(step.name)) errors.push(`${rel}: HowTo step name is not visible: ${step.name}`);
      if (step.text && !contentAppears(text, step.text)) errors.push(`${rel}: HowTo step text is not visible: ${String(step.text).slice(0, 90)}`);
    }
  }
}
