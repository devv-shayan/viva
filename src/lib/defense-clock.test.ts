import { describe, expect, it } from "vitest";

import {
  MAX_DEFENSE_ELAPSED_MS,
  getDefenseElapsedMs,
  isDefenseTimeExpired,
  pauseDefenseClock,
  resumeDefenseClock,
} from "./defense-clock";

describe("defense clock", () => {
  it("reaches the five-minute cap exactly as much wall time later as it was paused", () => {
    const pauseDurationMs = 75_000;
    const startedAtMs = 0;
    const paused = pauseDefenseClock(
      {
        connectionOffsetMs: 0,
        connectionStartedAtMs: startedAtMs,
        pausedMs: 0,
        pauseStartedAtMs: null,
      },
      120_000,
    );
    const resumed = resumeDefenseClock(paused, 120_000 + pauseDurationMs);

    expect(
      isDefenseTimeExpired(resumed, MAX_DEFENSE_ELAPSED_MS + pauseDurationMs - 1),
    ).toBe(false);
    expect(
      isDefenseTimeExpired(resumed, MAX_DEFENSE_ELAPSED_MS + pauseDurationMs),
    ).toBe(true);
  });

  it("freezes elapsed time without changing recorded turn timestamps", () => {
    const recordedTurns = [
      { id: "agent-1", t: 18_000 },
      { id: "student-1", t: 41_000 },
    ];
    const clock = pauseDefenseClock(
      {
        connectionOffsetMs: 0,
        connectionStartedAtMs: 0,
        pausedMs: 0,
        pauseStartedAtMs: null,
      },
      50_000,
    );

    expect(getDefenseElapsedMs(clock, 110_000)).toBe(50_000);
    expect(resumeDefenseClock(clock, 110_000).pausedMs).toBe(60_000);
    expect(recordedTurns).toEqual([
      { id: "agent-1", t: 18_000 },
      { id: "student-1", t: 41_000 },
    ]);
  });
});
