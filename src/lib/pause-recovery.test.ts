import { describe, expect, it } from "vitest";

import {
  consumePauseFocusRecovery,
  createPauseRecoveryState,
  markAgentResponseRequested,
  markPauseOwnedResponseStarted,
  markPauseInterruptRequested,
  recordRealtimeResponseDone,
} from "./pause-recovery";

describe("pause recovery", () => {
  it("re-asks the active focus only after pause cancelled Viva's reply", () => {
    let state = createPauseRecoveryState();
    state = markAgentResponseRequested(state);
    state = markPauseInterruptRequested(state);
    state = recordRealtimeResponseDone(state, {
      status: "cancelled",
      status_details: { reason: "client_cancelled" },
    });

    const recovery = consumePauseFocusRecovery(state);

    expect(recovery.shouldReaskFocus).toBe(true);
    expect(consumePauseFocusRecovery(recovery.state).shouldReaskFocus).toBe(
      false,
    );
  });

  it("does not re-ask when a student pauses without an in-flight Viva reply", () => {
    let state = createPauseRecoveryState();
    state = markPauseInterruptRequested(state);
    state = recordRealtimeResponseDone(state, { status: "completed" });

    expect(consumePauseFocusRecovery(state).shouldReaskFocus).toBe(false);
  });

  it("recovers the focus when a reply starts after pause won the transport race", () => {
    let state = createPauseRecoveryState();
    state = markAgentResponseRequested(state);
    state = markPauseInterruptRequested(state);
    state = markPauseOwnedResponseStarted(state);
    state = recordRealtimeResponseDone(state, { status: "completed" });

    expect(consumePauseFocusRecovery(state).shouldReaskFocus).toBe(true);
  });
});
