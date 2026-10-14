import { describe, it, expect } from "vitest";
import { catalog, getById } from "../lib/catalog";

describe("catalog", () => {
  it("loads and validates all 14 programmes", () => {
    expect(catalog).toHaveLength(14);
  });

  it("has unique ids", () => {
    const ids = new Set(catalog.map((p) => p.id));
    expect(ids.size).toBe(catalog.length);
  });

  it("finds a programme by id", () => {
    expect(getById("P04")?.name_en).toBe("Arabic Creative Writing");
  });

  it("tolerates whitespace and lowercase ids", () => {
    expect(getById(" p04 ")?.id).toBe("P04");
  });

  it("returns undefined for unknown ids", () => {
    expect(getById("P99")).toBeUndefined();
  });
});
