import test from "node:test";
import assert from "node:assert/strict";
import {
  productAvailabilityForQty,
  withDerivedProductAvailability,
} from "../lib/product-availability.mjs";

test("derives availability only from the stock quantity", () => {
  assert.equal(productAvailabilityForQty(2), "В наявності");
  assert.equal(productAvailabilityForQty("1"), "В наявності");
  assert.equal(productAvailabilityForQty(0), "Під замовлення");
  assert.equal(productAvailabilityForQty(-1), "Під замовлення");
  assert.equal(productAvailabilityForQty("invalid"), "Під замовлення");
});

test("repairs inconsistent product data before it reaches the storefront", () => {
  assert.deepEqual(
    withDerivedProductAvailability({ id: 1, qty: 2, availability: "Під замовлення" }),
    { id: 1, qty: 2, availability: "В наявності" },
  );
  assert.deepEqual(
    withDerivedProductAvailability({ id: 2, qty: 0, availability: "В наявності" }),
    { id: 2, qty: 0, availability: "Під замовлення" },
  );
});
