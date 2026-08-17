const SITE_URL = "https://dieselhub.com.ua";
const API_URL = (import.meta.env.VITE_API_BASE || "https://diesel-api.onrender.com").replace(/\/$/, "");
const DEFAULT_TITLE = "Diesel Hub — Форсунки та ПНВТ Common Rail";
const DEFAULT_DESCRIPTION = "Магазин форсунок і ПНВТ Common Rail. Нові та відновлені деталі, гарантія 6 місяців і доставка по Україні.";
const DEFAULT_IMAGE = `${SITE_URL}/og-1200x630.png`;

function setMeta(selector, attribute, value) {
  let node = document.head.querySelector(selector);
  if (!node) { node = document.createElement("meta"); document.head.appendChild(node); }
  const [name, key] = attribute;
  node.setAttribute(name, key);
  node.setAttribute("content", value);
}

function setCanonical(url) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) { node = document.createElement("link"); node.rel = "canonical"; document.head.appendChild(node); }
  node.href = url;
}

export function productPath(product) {
  return `/product/${encodeURIComponent(String(product?.number || product?.id || "").trim())}`;
}

export function applyProductSeo(product) {
  if (!product) return resetSeo();
  const number = String(product.number || "").trim();
  const brand = String(product.manufacturer || "Diesel Hub").trim();
  const related = [product.oem, ...(Array.isArray(product.cross) ? product.cross : [])].filter(Boolean);
  const title = `${product.type || "Форсунка"} ${brand} ${number} — купити в Україні | Diesel Hub`;
  const description = `${product.type || "Форсунка"} ${brand} ${number}. ${product.condition || ""}. OEM та крос-номери: ${related.slice(0, 6).join(", ") || "у картці товару"}. Гарантія 6 місяців, доставка по Україні.`.slice(0, 300);
  const canonical = `${SITE_URL}${productPath(product)}`;
  const shareImage = `${API_URL}/api/og/product/${encodeURIComponent(number)}.jpg`;
  document.title = title;
  setMeta('meta[name="description"]', ["name", "description"], description);
  setMeta('meta[property="og:type"]', ["property", "og:type"], "product");
  setMeta('meta[property="og:title"]', ["property", "og:title"], title);
  setMeta('meta[property="og:description"]', ["property", "og:description"], description);
  setMeta('meta[property="og:url"]', ["property", "og:url"], canonical);
  setMeta('meta[property="og:image"]', ["property", "og:image"], shareImage);
  setMeta('meta[property="og:image:secure_url"]', ["property", "og:image:secure_url"], shareImage);
  setMeta('meta[property="og:image:type"]', ["property", "og:image:type"], "image/jpeg");
  setMeta('meta[property="og:image:width"]', ["property", "og:image:width"], "1200");
  setMeta('meta[property="og:image:height"]', ["property", "og:image:height"], "630");
  setMeta('meta[name="twitter:title"]', ["name", "twitter:title"], title);
  setMeta('meta[name="twitter:description"]', ["name", "twitter:description"], description);
  setMeta('meta[name="twitter:image"]', ["name", "twitter:image"], shareImage);
  setCanonical(canonical);
  document.head.querySelector('#product-jsonld')?.remove();
  const script = document.createElement("script");
  script.id = "product-jsonld"; script.type = "application/ld+json";
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: `${brand} ${number}`, sku: number, mpn: product.oem || number, brand: { "@type": "Brand", name: brand }, image: product.images || [], description, additionalProperty: related.map(value => ({ "@type": "PropertyValue", name: "Крос-номер / OEM", value })), offers: { "@type": "Offer", url: canonical, priceCurrency: "UAH", price: Number(product.price || 0), availability: Number(product.qty || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/PreOrder" } });
  document.head.appendChild(script);
}

export function resetSeo() {
  document.title = DEFAULT_TITLE;
  setMeta('meta[name="description"]', ["name", "description"], DEFAULT_DESCRIPTION);
  setMeta('meta[property="og:type"]', ["property", "og:type"], "website");
  setMeta('meta[property="og:title"]', ["property", "og:title"], DEFAULT_TITLE);
  setMeta('meta[property="og:description"]', ["property", "og:description"], DEFAULT_DESCRIPTION);
  setMeta('meta[property="og:url"]', ["property", "og:url"], `${SITE_URL}/`);
  setMeta('meta[property="og:image"]', ["property", "og:image"], DEFAULT_IMAGE);
  setMeta('meta[property="og:image:secure_url"]', ["property", "og:image:secure_url"], DEFAULT_IMAGE);
  setMeta('meta[name="twitter:title"]', ["name", "twitter:title"], DEFAULT_TITLE);
  setMeta('meta[name="twitter:description"]', ["name", "twitter:description"], DEFAULT_DESCRIPTION);
  setMeta('meta[name="twitter:image"]', ["name", "twitter:image"], DEFAULT_IMAGE);
  setCanonical(`${SITE_URL}/`);
  document.head.querySelector('#product-jsonld')?.remove();
}
