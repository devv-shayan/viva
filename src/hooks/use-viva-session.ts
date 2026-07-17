"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  VIVA_SESSION_STORAGE_KEY,
  activatePendingFocus,
  applyAssessDelta,
  appendRealtimeResponseDiagnostic,
  appendTranscriptTurn,
  createDefenseSession,
  finishDefense,
  parseVivaSession,
  queueFocus,
  saveStudentReviewNote,
  serializeVivaSession,
  type DefenseDraft,
  type Focus,
  type RealtimeResponseDiagnostic,
  type TranscriptTurn,
  type VivaSessionState,
} from "@/lib/session-state";
import type { AssessDelta } from "@/lib/assess-types";

type SessionUpdater = (
  session: VivaSessionState | null,
) => VivaSessionState | null;

/**
 * The durable, consented portion of the defense state. The analyzed draft is
 * deliberately kept outside this hook until `startDefense` is called so no
 * submission is written to browser storage before the student agrees.
 */
export function useVivaSession() {
  const [session, setSession] = useState<VivaSessionState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const sessionRef = useRef<VivaSessionState | null>(null);

  useEffect(() => {
    const restored = parseVivaSession(
      window.localStorage.getItem(VIVA_SESSION_STORAGE_KEY),
    );

    sessionRef.current = restored;
    setSession(restored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!session) {
      window.localStorage.removeItem(VIVA_SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      VIVA_SESSION_STORAGE_KEY,
      serializeVivaSession(session),
    );
  }, [hydrated, session]);

  const commit = useCallback((updater: SessionUpdater) => {
    const next = updater(sessionRef.current);
    sessionRef.current = next;
    setSession(next);
    return next;
  }, []);

  const startDefense = useCallback(
    (draft: DefenseDraft) => commit(() => createDefenseSession(draft)),
    [commit],
  );

  const activateFocus = useCallback(
    () =>
      commit((current) =>
        current ? activatePendingFocus(current) : current,
      ),
    [commit],
  );

  const setPendingFocus = useCallback(
    (focus: Focus | undefined) =>
      commit((current) => (current ? queueFocus(current, focus) : current)),
    [commit],
  );

  const appendTurn = useCallback(
    (turn: TranscriptTurn) =>
      commit((current) =>
        current ? appendTranscriptTurn(current, turn) : current,
      ),
    [commit],
  );

  const appendRealtimeDiagnostic = useCallback(
    (diagnostic: RealtimeResponseDiagnostic) =>
      commit((current) =>
        current ? appendRealtimeResponseDiagnostic(current, diagnostic) : current,
      ),
    [commit],
  );

  const applyAssessment = useCallback(
    (delta: AssessDelta) =>
      commit((current) => (current ? applyAssessDelta(current, delta) : current)),
    [commit],
  );

  const completeDefense = useCallback(
    () => commit((current) => (current ? finishDefense(current) : current)),
    [commit],
  );

  const saveReviewNote = useCallback(
    (note: string) =>
      commit((current) =>
        current ? saveStudentReviewNote(current, note) : current,
      ),
    [commit],
  );

  const clearSession = useCallback(() => commit(() => null), [commit]);

  return {
    activateFocus,
    applyAssessment,
    appendRealtimeDiagnostic,
    appendTurn,
    clearSession,
    completeDefense,
    hydrated,
    session,
    saveReviewNote,
    setPendingFocus,
    startDefense,
  };
}
