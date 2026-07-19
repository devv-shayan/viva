import { describe, expect, it, vi } from "vitest";

import { createSessionSaveQueue } from "./session-save-queue";

describe("assigned-session save queue", () => {
  it("keeps one request in flight and writes only the newest cumulative snapshot next", async () => {
    let resolveFirst!: () => void;
    const save = vi.fn((snapshot: string) => {
      if (snapshot === "first") {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }

      return Promise.resolve();
    });
    const queue = createSessionSaveQueue(save);

    queue.schedule("first");
    queue.schedule("second");
    queue.schedule("third");

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("first");

    resolveFirst();
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(1, "first");
    expect(save).toHaveBeenNthCalledWith(2, "third");
  });

  it("keeps a failed snapshot available for an explicit retry", async () => {
    const error = new Error("network unavailable");
    const save = vi
      .fn<(_: string) => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const queue = createSessionSaveQueue(save);

    queue.schedule("complete transcript");

    await expect(queue.flush()).rejects.toThrow("network unavailable");
    expect(save).toHaveBeenCalledTimes(1);

    await expect(queue.flush()).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("complete transcript");
  });
});
