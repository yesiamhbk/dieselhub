import test from "node:test";
import assert from "node:assert/strict";
import { getPaginationItems } from "../src/pagination.js";

test("shows pages 5 and 6 when page 4 is selected", () => {
  assert.deepEqual(
    getPaginationItems(17, 4),
    [1, 2, 3, 4, 5, 6, "…", 16, 17],
  );
});

test("keeps neighbouring pages visible in the middle of the catalog", () => {
  assert.deepEqual(
    getPaginationItems(17, 8),
    [1, 2, "…", 7, 8, 9, "…", 16, 17],
  );
});

test("shows all page numbers for a short catalog", () => {
  assert.deepEqual(getPaginationItems(6, 4), [1, 2, 3, 4, 5, 6]);
});
