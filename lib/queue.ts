import type { ChatResponse, Profile } from "./types";

// Limits how many chat turns run at the same time. Extra turns wait in line (first in, first out);
// when the line is full, or a turn waits too long, it is turned away with a friendly reply.
// In-memory, so per server instance: a multi-instance deployment would use a shared queue (e.g. Redis).

export type QueueOptions = {
  maxConcurrent: number; // turns running at the same time
  maxWaiting: number; // turns allowed to wait in line
  maxWaitMs: number; // longest a turn may wait before giving up
};

export class QueueBusyError extends Error {
  readonly reason: "full" | "timeout";
  constructor(reason: "full" | "timeout") {
    super(`Chat queue ${reason}`);
    this.name = "QueueBusyError";
    this.reason = reason;
  }
}

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class TurnQueue {
  private readonly options: QueueOptions;
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(options: QueueOptions) {
    this.options = options;
  }

  get stats() {
    return { active: this.active, waiting: this.waiting.length };
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release(); // always free the place, even if the task throws
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.options.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.options.maxWaiting) {
      return Promise.reject(new QueueBusyError("full"));
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(waiter);
          if (index !== -1) this.waiting.splice(index, 1);
          reject(new QueueBusyError("timeout"));
        }, this.options.maxWaitMs),
      };
      this.waiting.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(); // the place passes straight to the next turn in line
    } else {
      this.active -= 1;
    }
  }
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// One queue for the whole server process.
export const chatQueue = new TurnQueue({
  maxConcurrent: envInt("MAX_CONCURRENT_TURNS", 4),
  maxWaiting: envInt("MAX_QUEUED_TURNS", 20),
  maxWaitMs: envInt("MAX_QUEUE_WAIT_MS", 15_000),
});

// Server-written reply when the queue can't take the turn.
export function busyReply(profile: Profile): ChatResponse {
  const ar = profile.language === "ar";
  return {
    language: profile.language,
    text: ar
      ? "يستخدم الكثير من الطلاب المستشار الآن. يرجى المحاولة مرة أخرى بعد قليل."
      : "Lots of students are using the advisor right now. Please try again in a moment.",
    choices: ar ? ["حاول مرة أخرى"] : ["Try again"],
    programmes: [],
    profile,
  };
}
