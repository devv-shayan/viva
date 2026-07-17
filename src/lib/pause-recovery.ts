import type { RealtimeResponse } from "./realtime-session";

export type PauseRecoveryState = {
  agentResponseInFlight: boolean;
  pauseInterruptPending: boolean;
  shouldReaskFocus: boolean;
};

export function createPauseRecoveryState(): PauseRecoveryState {
  return {
    agentResponseInFlight: false,
    pauseInterruptPending: false,
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
  };
}

export function markPauseInterruptRequested(
  state: PauseRecoveryState,
): PauseRecoveryState {
  return {
    ...state,
    // A pause during a student answer has no model response to recover.
    pauseInterruptPending: state.agentResponseInFlight,
    shouldReaskFocus: false,
  };
}

export function recordRealtimeResponseDone(
  state: PauseRecoveryState,
  response: RealtimeResponse | null | undefined,
): PauseRecoveryState {
  const didPauseInterruptViva =
    state.pauseInterruptPending &&
    response?.status === "cancelled" &&
    response.status_details?.reason === "client_cancelled";

  return {
    ...state,
    agentResponseInFlight: false,
    pauseInterruptPending: false,
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
