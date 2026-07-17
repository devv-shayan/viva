import { describe, expect, it } from "vitest";

import {
  createRealtimeClientSecretSession,
  getRealtimeResponseDiagnostic,
  REALTIME_MAX_OUTPUT_TOKENS,
} from "./realtime-session";

describe("Realtime session safeguards", () => {
  it("allows the consent statement and a grounded question while keeping a hard reply cap", () => {
    expect(REALTIME_MAX_OUTPUT_TOKENS).toBe(1_024);
    expect(createRealtimeClientSecretSession("gpt-realtime-2.1-mini")).toEqual({
      max_output_tokens: 1_024,
      model: "gpt-realtime-2.1-mini",
      type: "realtime",
    });
  });

  it("turns an incomplete output-cap response into a student-visible diagnostic", () => {
    expect(
      getRealtimeResponseDiagnostic({
        status: "incomplete",
        status_details: { reason: "max_output_tokens" },
        usage: {
          output_token_details: { audio_tokens: 940, text_tokens: 84 },
          output_tokens: 1_024,
        },
      }),
    ).toContain("reply limit");
  });

  it("does not show an error for a completed or intentionally cancelled reply", () => {
    expect(getRealtimeResponseDiagnostic({ status: "completed" })).toBeNull();
    expect(getRealtimeResponseDiagnostic({ status: "cancelled" })).toBeNull();
  });
});
