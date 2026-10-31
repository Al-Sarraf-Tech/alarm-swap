import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text, max) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

export function ogSvg({ kicker, title, footer }) {
  const lines = wrap(title, 32);
  const tspans = lines
    .map((line, i) => `<tspan x="72" dy="${i === 0 ? 0 : 68}">${esc(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(title)}">
  <rect width="1200" height="630" fill="#12151c"/>
  <rect x="0" y="0" width="16" height="630" fill="#b42318"/>
  <circle cx="108" cy="108" r="26" fill="none" stroke="#f97066" stroke-width="8"/>
  <circle cx="108" cy="108" r="8" fill="#f97066"/>
  <text x="152" y="120" fill="#e8eaf0" font-family="system-ui,Segoe UI,sans-serif" font-size="36" font-weight="700">AlarmSwap</text>
  <text x="72" y="168" fill="#fda29b" font-family="system-ui,Segoe UI,sans-serif" font-size="22">${esc(kicker || "")}</text>
  <text x="72" y="280" fill="#ffffff" font-family="system-ui,Segoe UI,sans-serif" font-size="52" font-weight="700">${tspans}</text>
  <text x="72" y="568" fill="#a3aab8" font-family="system-ui,Segoe UI,sans-serif" font-size="26">${esc(footer || "smokealarmswap.com")}</text>
</svg>
`;
}

function readYamlDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).map((n) =>
    yaml.load(fs.readFileSync(path.join(dir, n), "utf8"), { schema: yaml.CORE_SCHEMA })
  );
}

export function writeOgImages(root, siteDir) {
  const pages = [
    { out: "og/home.svg", kicker: "Reference", title: "What replaces the smoke alarm on your ceiling" },
    { out: "og/models.svg", kicker: "Models", title: "Smoke and CO alarm models" },
    { out: "og/guides.svg", kicker: "Guides", title: "Smoke alarm dates, expiry and replacement" },
    { out: "og/brands.svg", kicker: "Brands", title: "Kidde, Firex, and First Alert" },
  ];
  for (const model of readYamlDir(path.join(root, "src/_data/models"))) {
    pages.push({
      out: `og/models/${model.slug}.svg`,
      kicker: model.brand,
      title: model.title,
    });
  }
  for (const guide of readYamlDir(path.join(root, "src/_data/guides"))) {
    pages.push({
      out: `og/guides/${guide.slug}.svg`,
      kicker: "Guide",
      title: guide.title,
    });
  }
  const hubs = yaml.load(fs.readFileSync(path.join(root, "src/_data/brandHubs.yaml"), "utf8"), { schema: yaml.CORE_SCHEMA });
  for (const hub of hubs) {
    pages.push({
      out: `og/brands/${hub.slug}.svg`,
      kicker: "Brand",
      title: hub.title,
    });
  }
  for (const page of pages) {
    const dest = path.join(siteDir, page.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, ogSvg(page));
  }
}
