export const PRODUCT_VARIANTS = Object.freeze({
  NEW: "new",
  RESTORED: "restored",
  RESTORED_CLASS_2: "restored_class_2",
});

export function normalizeProductRouteNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
}

export function productVariant(product) {
  const condition = String(product?.condition || "")
    .trim()
    .toUpperCase()
    .replace(/[•·._-]+/g, " ")
    .replace(/\s+/g, " ");

  if (/(?:КЛАС|КЛАСС|CLASS)\s*2|2\s*(?:КЛАС|КЛАСС|CLASS)/u.test(condition)) {
    return PRODUCT_VARIANTS.RESTORED_CLASS_2;
  }
  if (/^(?:ВІДНОВ|ВОССТАН|RESTOR|REMAN)/u.test(condition)) {
    return PRODUCT_VARIANTS.RESTORED;
  }
  return PRODUCT_VARIANTS.NEW;
}

export function productRouteSlug(product) {
  const number = normalizeProductRouteNumber(product?.number || product?.id);
  const variant = productVariant(product);
  const suffix = variant === PRODUCT_VARIANTS.RESTORED_CLASS_2
    ? "-R2"
    : variant === PRODUCT_VARIANTS.RESTORED
      ? "-R"
      : "";
  return `${number}${suffix}`;
}

export function productRoutePath(product) {
  return `/product/${encodeURIComponent(productRouteSlug(product))}`;
}

export function parseProductRouteSlug(value) {
  let slug = String(value || "").trim();
  try { slug = decodeURIComponent(slug); } catch {}
  slug = slug.replace(/\.jpg$/i, "");

  let variant = PRODUCT_VARIANTS.NEW;
  if (/-R2$/i.test(slug)) {
    variant = PRODUCT_VARIANTS.RESTORED_CLASS_2;
    slug = slug.slice(0, -3);
  } else if (/-R$/i.test(slug)) {
    variant = PRODUCT_VARIANTS.RESTORED;
    slug = slug.slice(0, -2);
  }

  return { number: normalizeProductRouteNumber(slug), variant };
}

export function findProductForRoute(products, routeSlug, options = {}) {
  if (!Array.isArray(products)) return null;
  const route = parseProductRouteSlug(routeSlug);
  if (!route.number) return null;

  const matchRelated = options.matchRelated !== false;
  const candidates = products.filter((product) => {
    const values = matchRelated
      ? [product?.number, product?.oem, ...(Array.isArray(product?.cross) ? product.cross : [])]
      : [product?.number];
    return values.some((value) => normalizeProductRouteNumber(value) === route.number);
  });

  const exactVariant = candidates.find((product) => productVariant(product) === route.variant);
  if (exactVariant) return exactVariant;

  // Old unsuffixed links keep working when a number exists only as a restored item.
  if (route.variant === PRODUCT_VARIANTS.NEW && options.allowDefaultFallback !== false) {
    return candidates[0] || null;
  }
  return null;
}
