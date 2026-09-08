import test from "node:test";
import assert from "node:assert/strict";
import {
  findProductForRoute,
  parseProductRouteSlug,
  productRoutePath,
} from "../lib/product-route.mjs";

const variants = [
  { id: "new", number: "166006212R", oem: "166006212R", cross: ["A2C59507596"], condition: "Нове" },
  { id: "restored", number: "166006212R", oem: "166006212R", cross: ["A2C59507596"], condition: "Відновлене" },
  { id: "class-2", number: "166006212R", oem: "166006212R", cross: ["A2C59507596"], condition: "Відновлене • Клас 2" },
];

test("builds a distinct product URL for every condition", () => {
  assert.equal(productRoutePath(variants[0]), "/product/166006212R");
  assert.equal(productRoutePath(variants[1]), "/product/166006212R-R");
  assert.equal(productRoutePath(variants[2]), "/product/166006212R-R2");
});

test("parses condition suffixes without confusing a number ending in R", () => {
  assert.deepEqual(parseProductRouteSlug("166006212R"), { number: "166006212R", variant: "new" });
  assert.deepEqual(parseProductRouteSlug("166006212R-R"), { number: "166006212R", variant: "restored" });
  assert.deepEqual(parseProductRouteSlug("166006212R-R2.jpg"), { number: "166006212R", variant: "restored_class_2" });
});

test("opens the exact condition selected by the URL", () => {
  assert.equal(findProductForRoute(variants, "166006212R")?.id, "new");
  assert.equal(findProductForRoute(variants, "166006212R-R")?.id, "restored");
  assert.equal(findProductForRoute(variants, "166006212R-R2")?.id, "class-2");
  assert.equal(findProductForRoute(variants, "A2C59507596-R2")?.id, "class-2");
});

test("keeps an old plain link working when only a restored item exists", () => {
  assert.equal(findProductForRoute([variants[1]], "166006212R")?.id, "restored");
  assert.equal(findProductForRoute([variants[0]], "166006212R-R"), null);
});
