export const MAX_DEFENSE_ELAPSED_MS = 5 * 60 * 1000;

export type DefenseClock = {
  connectionOffsetMs: number;
  connectionStartedAtMs: number | null;
  pausedMs: number;
  pauseStartedAtMs: number | null;
};

function nonNegative(value: number) {
  return Math.max(0, value);
}

/**
 * Transcript offsets advance only while the defense is active. `pausedMs` is
 * deliberately clock-only state: it never rewrites a turn that was recorded
 * before the pause.
 */
export function getDefenseElapsedMs(clock: DefenseClock, nowMs: number) {
  if (clock.connectionStartedAtMs === null) {
    return Math.round(nonNegative(clock.connectionOffsetMs));
  }

  const inProgressPauseMs =
    clock.pauseStartedAtMs === null
      ? 0
      : nonNegative(nowMs - clock.pauseStartedAtMs);

  return Math.round(
    nonNegative(
      clock.connectionOffsetMs +
        nowMs -
        clock.connectionStartedAtMs -
        clock.pausedMs -
        inProgressPauseMs,
    ),
  );
}

export function pauseDefenseClock(clock: DefenseClock, nowMs: number): DefenseClock {
  if (
    clock.connectionStartedAtMs === null ||
    clock.pauseStartedAtMs !== null
  ) {
    return clock;
  }

  return { ...clock, pauseStartedAtMs: nowMs };
}

export function resumeDefenseClock(clock: DefenseClock, nowMs: number): DefenseClock {
  if (clock.pauseStartedAtMs === null) {
    return clock;
  }

  return {
    ...clock,
    pausedMs:
      clock.pausedMs + nonNegative(nowMs - clock.pauseStartedAtMs),
    pauseStartedAtMs: null,
  };
}

export function isDefenseTimeExpired(clock: DefenseClock, nowMs: number) {
  return getDefenseElapsedMs(clock, nowMs) >= MAX_DEFENSE_ELAPSED_MS;
}
