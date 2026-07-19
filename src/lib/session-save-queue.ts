/**
 * Serializes durable full-session writes. State reducers produce cumulative
 * snapshots, so while a write is in flight only the newest queued snapshot
 * needs to be sent next. This prevents an older PATCH from completing after a
 * newer one and replacing a transcript with stale state.
 */
export type SessionSaveQueue<T> = {
  flush: () => Promise<void>;
  schedule: (snapshot: T) => void;
};

export function createSessionSaveQueue<T>(
  save: (snapshot: T) => Promise<void>,
  onError?: (error: unknown) => void,
): SessionSaveQueue<T> {
  let active: Promise<void> | null = null;
  let activeSnapshot: T | undefined;
  let hasPendingSnapshot = false;
  let lastSavedSnapshot: T | undefined;
  let pendingSnapshot: T | undefined;

  async function drain() {
    while (hasPendingSnapshot) {
      const snapshot = pendingSnapshot as T;
      hasPendingSnapshot = false;
      pendingSnapshot = undefined;
      activeSnapshot = snapshot;

      try {
        await save(snapshot);
        lastSavedSnapshot = snapshot;
      } catch (error) {
        // A newer snapshot, if one arrived while this request was in flight,
        // includes this state. Otherwise keep this snapshot available for an
        // explicit retry rather than silently losing it.
        if (!hasPendingSnapshot) {
          pendingSnapshot = snapshot;
          hasPendingSnapshot = true;
        }
        throw error;
      } finally {
        activeSnapshot = undefined;
      }
    }
  }

  function start() {
    if (active || !hasPendingSnapshot) return;

    const run = drain();
    active = run;

    void run.then(
      () => {
        if (active !== run) return;
        active = null;
        if (hasPendingSnapshot) start();
      },
      (error) => {
        if (active === run) active = null;
        try {
          onError?.(error);
        } catch {
          // A persistence diagnostic must never create an unhandled promise.
        }
      },
    );
  }

  function schedule(snapshot: T) {
    if (snapshot === lastSavedSnapshot || snapshot === activeSnapshot) return;

    if (hasPendingSnapshot && snapshot === pendingSnapshot) {
      start();
      return;
    }

    pendingSnapshot = snapshot;
    hasPendingSnapshot = true;
    start();
  }

  function flush() {
    start();
    return active ?? Promise.resolve();
  }

  return { flush, schedule };
}
