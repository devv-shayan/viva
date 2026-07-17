import { describe, expect, it, vi } from "vitest";

import {
  MISSING_TRANSCRIPT_ITEM_ID_WARNING,
  requireStableTranscriptItemId,
} from "./realtime-transcript";

describe("final Realtime transcript events", () => {
  it("keeps a stable item ID for duplicate-event protection", () => {
    expect(
      requireStableTranscriptItemId(
        { item_id: " item-agent-1 ", type: "response.output_audio_transcript.done" },
        vi.fn(),
      ),
    ).toBe("item-agent-1");
  });

  it("drops and logs a final transcript event without an item ID", () => {
    const warn = vi.fn();

    expect(
      requireStableTranscriptItemId(
        { type: "conversation.item.input_audio_transcription.completed" },
        warn,
      ),
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(MISSING_TRANSCRIPT_ITEM_ID_WARNING, {
      eventType: "conversation.item.input_audio_transcription.completed",
    });
  });
});
