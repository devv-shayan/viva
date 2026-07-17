export type RealtimeTranscriptEvent = {
  item_id?: string;
  type: string;
};

export const MISSING_TRANSCRIPT_ITEM_ID_WARNING =
  "Dropped final transcription event without a stable item_id.";

/**
 * Final transcript events must have a stable item ID so repeated delivery can
 * be deduplicated safely. Do not fall back to transcript text: the same words
 * can be valid, separate turns.
 */
export function requireStableTranscriptItemId(
  event: RealtimeTranscriptEvent,
  warn: (message: string, detail: { eventType: string }) => void = console.warn,
) {
  const itemId = event.item_id?.trim();

  if (itemId) {
    return itemId;
  }

  warn(MISSING_TRANSCRIPT_ITEM_ID_WARNING, { eventType: event.type });
  return null;
}
