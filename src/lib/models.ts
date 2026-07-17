/**
 * Deliberately small model policy for the MVP. Keeping it in one place makes
 * price/performance changes explicit rather than scattering model IDs across
 * routes and UI code.
 */
export const vivaModels = {
  analysis: "gpt-5.6-terra",
  assessment: "gpt-5.6-luna",
  dossier: "gpt-5.6-terra",
  realtime: "gpt-realtime-2.1-mini",
} as const;
