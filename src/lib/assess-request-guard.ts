/**
 * Prevents a late assessment completion from injecting a second FOCUS after a
 * deadline, reconnect, pause, or finish invalidates the original turn.
 */
export function createAssessmentRequestGuard() {
  let generation = 0;

  return {
    begin() {
      generation += 1;
      return generation;
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(token: number) {
      return token === generation;
    },
  };
}
