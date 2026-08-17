const SITE_URL = "https://dieselhub.com.ua";
const DEFAULT_TITLE = "Diesel Hub — Форсунки та ПНВТ Common Rail";
const DEFAULT_DESCRIPTION = "Магазин форсунок і ПНВТ Common Rail. Нові та відновлені деталі, гарантія 6 місяців і доставка по Україні.";

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
  document.title = title;
  setMeta('meta[name="description"]', ["name", "description"], description);
  setMeta('meta[property="og:title"]', ["property", "og:title"], title);
  setMeta('meta[property="og:description"]', ["property", "og:description"], description);
  setMeta('meta[property="og:url"]', ["property", "og:url"], canonical);
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
  setCanonical(`${SITE_URL}/`);
  document.head.querySelector('#product-jsonld')?.remove();
}
