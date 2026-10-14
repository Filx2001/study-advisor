import raw from "../data/catalog.json";
import { CatalogSchema } from "./schema";
import type { Program } from "./types";

// Validate once at load time: bad data fails fast and loudly.
export const catalog: Program[] = CatalogSchema.parse(raw);

const byId = new Map(catalog.map((p) => [p.id, p]));

export function getById(id: string): Program | undefined {
  return byId.get(id.trim().toUpperCase());
}
