import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchQuery } from "../src/analytics.js";

test("normalizes formatted part-number variants into one demand key", () => {
  assert.equal(normalizeSearchQuery("0 445-117-030"), "0445117030");
  assert.equal(normalizeSearchQuery("0445 117 030"), "0445117030");
});

test("normalization keeps OEM letters and removes unsafe punctuation", () => {
  assert.equal(normalizeSearchQuery(" 03l-130-277b<script> "), "03L130277BSCRIPT");
});
