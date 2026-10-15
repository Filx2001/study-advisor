import { describe, it, expect, vi } from "vitest";
import { TurnQueue, QueueBusyError, busyReply } from "../lib/queue";
import { sanitizeChoices } from "../lib/guards";

// A promise we can resolve from outside, to hold a turn "running".
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("turn queue", () => {
  it("runs at most maxConcurrent turns at once", async () => {
    const queue = new TurnQueue({
      maxConcurrent: 2,
      maxWaiting: 10,
      maxWaitMs: 1000,
    });
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred());
    const results = gates.map((gate, i) =>
      queue.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
        return i;
      }),
    );

    await flush();
    expect(queue.stats).toEqual({ active: 2, waiting: 3 });

    gates.forEach((g) => g.resolve());
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(queue.stats).toEqual({ active: 0, waiting: 0 });
  });

  it("serves waiting turns first in, first out", async () => {
    const queue = new TurnQueue({
      maxConcurrent: 1,
      maxWaiting: 10,
      maxWaitMs: 1000,
    });
    const order: number[] = [];
    const gate = deferred();
    const first = queue.run(async () => {
      await gate.promise;
      order.push(0);
    });
    const rest = [1, 2, 3].map((i) =>
      queue.run(async () => void order.push(i)),
    );

    gate.resolve();
    await Promise.all([first, ...rest]);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("turns new requests away when the line is full", async () => {
    const queue = new TurnQueue({
      maxConcurrent: 1,
      maxWaiting: 1,
      maxWaitMs: 1000,
    });
    const gate = deferred();
    const a = queue.run(() => gate.promise);
    const b = queue.run(async () => "b");

    await expect(queue.run(async () => "c")).rejects.toBeInstanceOf(
      QueueBusyError,
    );

    gate.resolve();
    await a;
    expect(await b).toBe("b");
  });

  it("gives up on a turn that waited too long", async () => {
    vi.useFakeTimers();
    try {
      const queue = new TurnQueue({
        maxConcurrent: 1,
        maxWaiting: 5,
        maxWaitMs: 100,
      });
      const gate = deferred();
      const a = queue.run(() => gate.promise);
      const b = queue.run(async () => "b");
      const bRejected = expect(b).rejects.toBeInstanceOf(QueueBusyError);

      await vi.advanceTimersByTimeAsync(101);
      await bRejected;
      expect(queue.stats).toEqual({ active: 1, waiting: 0 });

      gate.resolve();
      await a;
      expect(queue.stats).toEqual({ active: 0, waiting: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("frees its place even when a turn throws", async () => {
    const queue = new TurnQueue({
      maxConcurrent: 1,
      maxWaiting: 5,
      maxWaitMs: 1000,
    });
    await expect(
      queue.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await queue.run(async () => "ok")).toBe("ok");
    expect(queue.stats).toEqual({ active: 0, waiting: 0 });
  });

  it("the busy reply obeys the button rules in both languages", () => {
    for (const language of ["en", "ar"] as const) {
      const reply = busyReply({ language });
      expect(reply.programmes).toEqual([]);
      expect(sanitizeChoices(reply.choices)).toEqual(reply.choices);
    }
  });
});
