export const REALTIME_MAX_OUTPUT_TOKENS = 1_024;

type RealtimeResponseStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "in_progress"
  | "incomplete";

type RealtimeResponseReason =
  | "client_cancelled"
  | "content_filter"
  | "max_output_tokens"
  | "turn_detected";

export type RealtimeResponse = {
  id?: string | null;
  status?: RealtimeResponseStatus | null;
  status_details?: {
    reason?: RealtimeResponseReason | null;
  } | null;
  usage?: {
    output_token_details?: {
      audio_tokens?: number;
      text_tokens?: number;
    } | null;
    output_tokens?: number;
  } | null;
};

export function createRealtimeClientSecretSession(model: string) {
  return {
    // Realtime output tokens include the spoken audio as well as its transcript.
    // This leaves room for Viva's consent statement plus one concise,
    // document-grounded question, while still imposing a firm per-reply limit.
    max_output_tokens: REALTIME_MAX_OUTPUT_TOKENS,
    model,
    type: "realtime" as const,
  };
}

export function getRealtimeResponseDiagnostic(
  response: RealtimeResponse | null | undefined,
) {
  if (!response || response.status === "completed" || response.status === "cancelled") {
    return null;
  }

  if (response.status === "incomplete") {
    if (response.status_details?.reason === "max_output_tokens") {
      return "Viva reached its reply limit before it could finish. Please end and reconnect before continuing.";
    }

    if (response.status_details?.reason === "content_filter") {
      return "Viva could not complete that reply. Please end and reconnect before continuing.";
    }

    return "Viva could not complete that reply. Please end and reconnect before continuing.";
  }

  if (response.status === "failed") {
    return "Viva could not complete that reply because the voice connection failed. Please end and reconnect.";
  }

  return null;
}
