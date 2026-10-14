import { describe, it, expect, beforeEach } from "vitest";
import {
  allowRequest,
  resetRateLimit,
  MAX_REQUESTS,
  WINDOW_MS,
} from "../lib/rate-limit";

beforeEach(() => resetRateLimit());

describe("rate limit", () => {
  const t = 1_000_000;

  it("allows up to the limit, then blocks", () => {
    for (let i = 0; i < MAX_REQUESTS; i++)
      expect(allowRequest("a", t)).toBe(true);
    expect(allowRequest("a", t)).toBe(false);
  });

  it("allows again once the window has passed", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) allowRequest("a", t);
    expect(allowRequest("a", t + WINDOW_MS)).toBe(true);
  });

  it("counts each user separately", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) allowRequest("a", t);
    expect(allowRequest("b", t)).toBe(true);
  });
});
