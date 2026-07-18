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

/**
 * This is server-owned copy. The dossier generator never writes it, so the
 * evidence handoff cannot drift into an authorship or grading claim.
 */
export const DOSSIER_FRAMING_NOTE =
  "Viva reports what the student could and couldn't explain about their submitted work, with links to the exact passages and answers. It does not detect AI use, determine authorship, or make judgments — those decisions belong to the instructor.";
