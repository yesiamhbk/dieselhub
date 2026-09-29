import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildProductOgSvg,
  buildProductShareMeta,
  normalizeProductNumber,
  renderProductOgJpeg,
  renderProductShareHtml,
} from "../lib/product-preview.mjs";

const product = {
  id: "product-1",
  number: "166008052R",
  oem: "166008052R",
  cross: ["5WS40536"],
  manufacturer: "Continental",
  condition: "Нове",
  type: "Форсунка",
  availability: "В наявності",
  qty: 12,
  price: 11800,
  images: ["https://example.com/product.jpg"],
};

test("builds product-specific share metadata and branded image URL", () => {
  const meta = buildProductShareMeta(product);
  assert.equal(meta.canonical, "https://dieselhub.com.ua/product/166008052R");
  assert.equal(meta.image, "https://diesel-api.onrender.com/api/og/product/166008052R.jpg");
  assert.match(meta.title, /Форсунка Continental 166008052R/);
  assert.match(meta.title.replace(/\s/g, ""), /11800₴/);
  assert.match(meta.description, /В наявності · 12 шт/);
  assert.match(meta.description, /5WS40536/);
});

test("uses the condition suffix in canonical and social preview URLs", () => {
  const restored = buildProductShareMeta({ ...product, condition: "Відновлене" });
  const classTwo = buildProductShareMeta({ ...product, condition: "Відновлене · Клас 2" });
  assert.equal(restored.canonical, "https://dieselhub.com.ua/product/166008052R-R");
  assert.equal(restored.image, "https://diesel-api.onrender.com/api/og/product/166008052R-R.jpg");
  assert.equal(classTwo.canonical, "https://dieselhub.com.ua/product/166008052R-R2");
  assert.equal(classTwo.image, "https://diesel-api.onrender.com/api/og/product/166008052R-R2.jpg");
});

test("ignores a stale availability field and trusts the quantity", () => {
  const meta = buildProductShareMeta({ ...product, qty: 2, availability: "Під замовлення" });
  assert.match(meta.description, /В наявності · 2 шт/);
});

test("renders complete Open Graph and Twitter metadata safely", () => {
  const html = renderProductShareHtml({ ...product, manufacturer: 'Continental <script>alert("x")</script>' });
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="product:price:currency" content="UAH"/);
  assert.doesNotMatch(html, /<script>alert\("x"\)<\/script>/);
  assert.match(html, /Continental &lt;script&gt;alert/);
});

test("normalizes unsafe product path input", () => {
  assert.equal(normalizeProductNumber(" 16600 8052r/../ "), "166008052R");
});

test("renders a valid 1200 by 630 social preview canvas", async () => {
  assert.ok(buildProductOgSvg(product).length > 1000);
  const image = await renderProductOgJpeg(product);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(metadata.format, "jpeg");
});
