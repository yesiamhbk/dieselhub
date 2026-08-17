import sharp from "sharp";

const DEFAULT_SITE_URL = "https://dieselhub.com.ua";
const DEFAULT_API_URL = "https://diesel-api.onrender.com";

export function normalizeProductNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function escapeXml(value) {
  return escapeHtml(value);
}

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

export function formatPriceUah(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(amount)} ₴`
    : "Ціна за запитом";
}

export function productAvailability(product) {
  const qty = Math.max(0, Number(product?.qty) || 0);
  const inStock = cleanText(product?.availability) === "В наявності" && qty > 0;
  return inStock ? `В наявності · ${qty} шт` : "Під замовлення";
}

export function buildProductShareMeta(product, options = {}) {
  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
  const apiUrl = String(options.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  const number = normalizeProductNumber(product?.number || product?.id);
  const type = cleanText(product?.type, "Деталь");
  const brand = cleanText(product?.manufacturer, "Diesel Hub");
  const condition = cleanText(product?.condition);
  const price = formatPriceUah(product?.price);
  const availability = productAvailability(product);
  const oem = cleanText(product?.oem);
  const crosses = Array.isArray(product?.cross) ? product.cross.map((value) => cleanText(value)).filter(Boolean) : [];
  const related = [oem, ...crosses].filter(Boolean).slice(0, 3);
  const canonical = `${siteUrl}/product/${encodeURIComponent(number)}`;
  const image = `${apiUrl}/api/og/product/${encodeURIComponent(number)}.jpg`;
  const relatedText = related.length ? ` OEM/крос: ${related.join(", ")}.` : "";
  const description = `${availability}. ${condition ? `${condition}. ` : ""}${type} ${brand} ${number}.${relatedText} Гарантія 6 місяців, доставка по Україні.`.slice(0, 260);

  return {
    number,
    type,
    brand,
    condition,
    price,
    availability,
    canonical,
    image,
    title: `${type} ${brand} ${number} — ${price} | Diesel Hub`,
    description,
  };
}

export function renderProductShareHtml(product, options = {}) {
  const meta = buildProductShareMeta(product, options);
  const amount = Math.max(0, Number(product?.price) || 0);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${meta.type} ${meta.brand} ${meta.number}`,
    sku: meta.number,
    mpn: cleanText(product?.oem, meta.number),
    brand: { "@type": "Brand", name: meta.brand },
    image: [meta.image, ...(Array.isArray(product?.images) ? product.images : [])],
    description: meta.description,
    offers: {
      "@type": "Offer",
      url: meta.canonical,
      priceCurrency: "UAH",
      price: amount,
      availability: productAvailability(product).startsWith("В наявності")
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
    },
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <link rel="canonical" href="${escapeHtml(meta.canonical)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Diesel Hub">
  <meta property="og:locale" content="uk_UA">
  <meta property="og:url" content="${escapeHtml(meta.canonical)}">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:image" content="${escapeHtml(meta.image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(meta.image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(`${meta.type} ${meta.brand} ${meta.number} — Diesel Hub`)}">
  <meta property="product:price:amount" content="${escapeHtml(amount)}">
  <meta property="product:price:currency" content="UAH">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  <meta name="twitter:image" content="${escapeHtml(meta.image)}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    html,body{margin:0;min-height:100%;background:#061012;color:#f7fafa;font-family:Arial,sans-serif}
    main{max-width:720px;margin:0 auto;padding:48px 24px}a{color:#76dad8}p{line-height:1.6}
  </style>
</head>
<body>
  <main>
    <p>Diesel Hub</p>
    <h1>${escapeHtml(`${meta.type} ${meta.brand} ${meta.number}`)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    <p><strong>${escapeHtml(meta.price)}</strong></p>
    <p><a href="${escapeHtml(meta.canonical)}">Відкрити картку товару</a></p>
  </main>
</body>
</html>`;
}

export function buildProductOgSvg(product) {
  const meta = buildProductShareMeta(product);
  const numberSize = meta.number.length > 16 ? 43 : meta.number.length > 12 ? 50 : 62;
  const brandLine = [meta.brand, meta.condition].filter(Boolean).join(" · ").toUpperCase();

  return Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#061012"/>
        <stop offset="1" stop-color="#0c2427"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#34b7b7"/>
        <stop offset="1" stop-color="#76dad8"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
    <path d="M690 0 C930 70 1070 10 1200 90 V0 Z" fill="#123a3e" opacity=".7"/>
    <rect x="36" y="36" width="536" height="558" rx="28" fill="#edf7f6"/>
    <rect x="36" y="36" width="12" height="558" rx="6" fill="url(#accent)"/>
    <rect x="626" y="54" width="74" height="5" rx="3" fill="#34b7b7"/>
    <text x="716" y="70" fill="#76dad8" font-family="Arial,DejaVu Sans,sans-serif" font-size="28" font-weight="800" letter-spacing="3">DIESEL HUB</text>
    <text x="626" y="148" fill="#9cb0b2" font-family="Arial,DejaVu Sans,sans-serif" font-size="24" font-weight="700" letter-spacing="2">${escapeXml(brandLine)}</text>
    <text x="626" y="228" fill="#ffffff" font-family="Arial,DejaVu Sans,sans-serif" font-size="${numberSize}" font-weight="900">${escapeXml(meta.number)}</text>
    <text x="626" y="282" fill="#b7c7c8" font-family="Arial,DejaVu Sans,sans-serif" font-size="27">${escapeXml(meta.type)}</text>
    <rect x="626" y="330" width="510" height="1" fill="#315154"/>
    <text x="626" y="392" fill="#76dad8" font-family="Arial,DejaVu Sans,sans-serif" font-size="31" font-weight="800">${escapeXml(meta.availability)}</text>
    <text x="626" y="480" fill="#ffffff" font-family="Arial,DejaVu Sans,sans-serif" font-size="58" font-weight="900">${escapeXml(meta.price)}</text>
    <text x="626" y="548" fill="#9cb0b2" font-family="Arial,DejaVu Sans,sans-serif" font-size="23">Гарантія 6 місяців · Доставка по Україні</text>
    <rect x="626" y="574" width="510" height="4" rx="2" fill="url(#accent)"/>
  </svg>`);
}

export async function renderProductOgJpeg(product, photoSource = null) {
  let photoLayer;
  if (photoSource) {
    photoLayer = await sharp(photoSource, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(490, 510, { fit: "contain", background: "#edf7f6" })
      .png()
      .toBuffer();
  } else {
    const meta = buildProductShareMeta(product);
    photoLayer = Buffer.from(`<svg width="490" height="510" xmlns="http://www.w3.org/2000/svg">
      <rect width="490" height="510" fill="#edf7f6"/>
      <circle cx="245" cy="220" r="104" fill="none" stroke="#34b7b7" stroke-width="12" opacity=".65"/>
      <text x="245" y="226" text-anchor="middle" fill="#0b3539" font-family="Arial,sans-serif" font-size="30" font-weight="800">${meta.number}</text>
      <text x="245" y="370" text-anchor="middle" fill="#557577" font-family="Arial,sans-serif" font-size="23">Фото уточнюється</text>
    </svg>`);
  }

  return sharp({ create: { width: 1200, height: 630, channels: 3, background: "#061012" } })
    .composite([
      { input: buildProductOgSvg(product), left: 0, top: 0 },
      { input: photoLayer, left: 64, top: 60 },
    ])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
