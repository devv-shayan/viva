import type { RealtimeResponse } from "./realtime-session";

export type PauseRecoveryState = {
  agentResponseInFlight: boolean;
  pauseInterruptPending: boolean;
  pauseOwnedResponseStarted: boolean;
  shouldReaskFocus: boolean;
};

export function createPauseRecoveryState(): PauseRecoveryState {
  return {
    agentResponseInFlight: false,
    pauseInterruptPending: false,
    pauseOwnedResponseStarted: false,
    shouldReaskFocus: false,
  };
}

export function markAgentResponseRequested(
  state: PauseRecoveryState,
): PauseRecoveryState {
  return {
    ...state,
    agentResponseInFlight: true,
    pauseInterruptPending: false,
    pauseOwnedResponseStarted: false,
  };
}

export function markPauseInterruptRequested(
  state: PauseRecoveryState,
): PauseRecoveryState {
  return {
    ...state,
    // A pause during a student answer has no model response to recover.
    pauseInterruptPending: state.agentResponseInFlight,
    pauseOwnedResponseStarted: false,
    shouldReaskFocus: false,
  };
}

/**
 * Realtime can create a response just after `interrupt()` runs. Viva asks the
 * same focus again on resume if that pause-owned response wins the transport
 * race, even if its final event reports `completed` before cancellation lands.
 */
export function markPauseOwnedResponseStarted(
  state: PauseRecoveryState,
): PauseRecoveryState {
  if (!state.pauseInterruptPending) {
    return state;
  }

  return { ...state, pauseOwnedResponseStarted: true };
}

export function recordRealtimeResponseDone(
  state: PauseRecoveryState,
  response: RealtimeResponse | null | undefined,
): PauseRecoveryState {
  const didPauseInterruptViva =
    state.pauseInterruptPending &&
    ((response?.status === "cancelled" &&
      response.status_details?.reason === "client_cancelled") ||
      state.pauseOwnedResponseStarted);

  return {
    ...state,
    agentResponseInFlight: false,
    pauseInterruptPending: false,
    pauseOwnedResponseStarted: false,
    shouldReaskFocus: state.shouldReaskFocus || didPauseInterruptViva,
  };
}

export function consumePauseFocusRecovery(
  state: PauseRecoveryState,
): { state: PauseRecoveryState; shouldReaskFocus: boolean } {
  if (!state.shouldReaskFocus) {
    return { state, shouldReaskFocus: false };
  }

  return {
    state: { ...state, shouldReaskFocus: false },
    shouldReaskFocus: true,
  };
}
