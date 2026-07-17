/**
 * Student-facing commitments that must remain backed by the defense code and
 * assessment policy. Keep these concise enough to use directly in the UI.
 */
export const TRUST_PROMISES = {
  contentOnly:
    "Viva assesses the content of your answers — never your accent, fluency, hesitation, filler words, or confidence.",
  noVerdicts:
    "Viva never judges who wrote your work. It gives no grades or verdicts.",
  pauseIsFree:
    "You can pause at any time. Paused time does not count toward the five-minute conversation.",
} as const;

export const ASSESS_HICCUP_MESSAGE =
  "(one answer couldn't be processed — the recording is safe and the defense continues)";
