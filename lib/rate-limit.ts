// Simple in-memory sliding-window rate limit, per client.
// Good for a single server; a multi-instance deployment would need a shared store (e.g. Redis).
export const WINDOW_MS = 60_000;
export const MAX_REQUESTS = 20;

const hits = new Map<string, number[]>();

export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // cap memory use
  return true;
}

// For tests.
export function resetRateLimit(): void {
  hits.clear();
}
