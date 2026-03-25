import { describe, expect, it } from "vitest";

import {
  getRequiredScopes,
  hasRequiredScopes
} from "../src/scopes/required-scopes.js";

describe("management scope metadata", () => {
  it("exposes the least-privilege scopes declared in OpenAPI", () => {
    expect(getRequiredScopes("createProduct")).toEqual(["product:write"]);
    expect(getRequiredScopes("listEvents")).toEqual(["event:read"]);
  });

  it("treats admin as satisfying every management operation", () => {
    expect(hasRequiredScopes("createProduct", ["product:write"])).toBe(true);
    expect(hasRequiredScopes("createProduct", ["admin"])).toBe(true);
    expect(hasRequiredScopes("createProduct", ["product:read"])).toBe(false);
  });
});
