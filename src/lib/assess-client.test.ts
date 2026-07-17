import { describe, expect, it, vi } from "vitest";

import {
  AssessTimeoutError,
  createAssessLatencyMetrics,
  getAssessDeadlineMs,
  recordAssessLatency,
  requestAssessment,
} from "./assess-client";
import type { AssessRequest } from "./assess-types";
import { createAssessmentRequestGuard } from "./assess-request-guard";

const request = {
  answerTurns: [
    { id: "student-1", speaker: "student", text: "Road space is limited.", t: 1 },
  ],
  focus: {
    move: "grounded_question",
    claimId: "thesis",
    passage: { paragraphId: "p1", quote: "Road space" },
    hint: "Ask about the reasoning.",
  },
  graph: { thesis: {}, claims: [], weakSpots: [] },
  recentTurns: [
    { id: "student-1", speaker: "student", text: "Road space is limited.", t: 1 },
  ],
} as unknown as AssessRequest;

describe("assessment client safeguards", () => {
  it("records and logs latency from the first call, including median and worst case", async () => {
    const log = vi.fn();
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(1_300);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          claimId: "thesis",
          quality: "demonstrated",
          evidenceCited: true,
          note: "Explained the content reasoning.",
        }),
        { status: 200 },
      ),
    );

    await requestAssessment(request, {
      fetchImpl,
      log,
      now,
    });

    expect(log).toHaveBeenCalledWith("Viva assess latency", {
      count: 1,
      deadlineMs: 2_500,
      latestMs: 1_200,
      medianMs: 1_200,
      worstMs: 1_200,
    });
  });

  it("derives future deadlines from observed median and worst-case latency", () => {
    let metrics = createAssessLatencyMetrics();
    metrics = recordAssessLatency(metrics, 400);
    metrics = recordAssessLatency(metrics, 1_600);
    metrics = recordAssessLatency(metrics, 800);

    expect(metrics.medianMs).toBe(800);
    expect(metrics.worstMs).toBe(1_600);
    expect(getAssessDeadlineMs(metrics)).toBe(2_500);
  });

  it("turns a missed deadline into a timeout instead of waiting indefinitely", async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    );

    await expect(
      requestAssessment(request, {
        deadlineMs: 1,
        fetchImpl,
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(2),
      }),
    ).rejects.toBeInstanceOf(AssessTimeoutError);
  });

  it("does not treat a user pause or reconnect cancellation as service latency", async () => {
    const controller = new AbortController();
    const log = vi.fn();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    );

    const pending = requestAssessment(request, {
      fetchImpl,
      log,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toThrow("Viva could not process that answer.");
    expect(log).not.toHaveBeenCalled();
  });

  it("invalidates late assessment completions after a lifecycle change", () => {
    const guard = createAssessmentRequestGuard();
    const token = guard.begin();

    expect(guard.isCurrent(token)).toBe(true);
    guard.invalidate(); // timeout, reconnect, pause, or finish
    expect(guard.isCurrent(token)).toBe(false);
  });
});
