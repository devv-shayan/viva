"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  VIVA_SESSION_STORAGE_KEY,
  VivaSessionSchema,
  activatePendingFocus,
  applyAssessDelta,
  appendRealtimeResponseDiagnostic,
  appendTranscriptTurn,
  createDossierRequest,
  createDefenseSession,
  finishDefense,
  completeStudentReview as persistStudentReviewCompletion,
  parseVivaSession,
  queueFocus,
  saveDossier as persistDossier,
  saveStudentChallenge as persistStudentChallenge,
  saveStudentReviewNote,
  saveTeacherFindingAction as persistTeacherFindingAction,
  serializeVivaSession,
  type DefenseDraft,
  type Focus,
  type RealtimeResponseDiagnostic,
  type TranscriptTurn,
  type VivaSessionState,
} from "@/lib/session-state";
import type { AssessDelta } from "@/lib/assess-types";
import type { Dossier, TeacherAction } from "@/lib/dossier-types";

type SessionUpdater = (
  session: VivaSessionState | null,
) => VivaSessionState | null;

/**
 * The durable, consented portion of the defense state. The analyzed draft is
 * deliberately kept outside this hook until `startDefense` is called so no
 * submission is written to browser storage before the student agrees.
 */
export function useVivaSession(vivaId?: string) {
  const [session, setSession] = useState<VivaSessionState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const sessionRef = useRef<VivaSessionState | null>(null);

  useEffect(() => {
    if (vivaId) {
      void fetch(`/api/vivas/${vivaId}/session`).then(async (response) => {
        const payload = (await response.json()) as { session?: VivaSessionState | null };
        const restored = response.ok && payload.session ? VivaSessionSchema.parse(payload.session) : null;
        sessionRef.current = restored;
        setSession(restored);
        setHydrated(true);
      });
      return;
    }
    const restored = parseVivaSession(window.localStorage.getItem(VIVA_SESSION_STORAGE_KEY));
    sessionRef.current = restored;
    setSession(restored);
    setHydrated(true);
  }, [vivaId]);

  useEffect(() => {
    if (!hydrated) return;
    if (vivaId) {
      if (session) void fetch(`/api/vivas/${vivaId}/session`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session }) });
      return;
    }
    if (!session) window.localStorage.removeItem(VIVA_SESSION_STORAGE_KEY);
    else window.localStorage.setItem(VIVA_SESSION_STORAGE_KEY, serializeVivaSession(session));
  }, [hydrated, session, vivaId]);
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
    (delta: AssessDelta, answerTurnIds: string[] = []) =>
      commit((current) =>
        current ? applyAssessDelta(current, delta, answerTurnIds) : current,
      ),
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

  const completeStudentReview = useCallback(() => {
    const next = commit((current) =>
      current ? persistStudentReviewCompletion(current) : current,
    );

    if (next) {
      window.localStorage.setItem(
        VIVA_SESSION_STORAGE_KEY,
        serializeVivaSession(next),
      );
    }

    return next;
  }, [commit]);
  const getDossierRequest = useCallback(() => {
    const current = sessionRef.current;
    return current?.phase === "student_review" && current.studentReviewCompletedAt
      ? createDossierRequest(current)
      : null;
  }, []);

  const saveDossier = useCallback(
    (dossier: Dossier) =>
      commit((current) => (current ? persistDossier(current, dossier) : current)),
    [commit],
  );

  const saveStudentChallenge = useCallback(
    (claimId: string, note: string) =>
      commit((current) =>
        current ? persistStudentChallenge(current, claimId, note) : current,
      ),
    [commit],
  );

  const saveTeacherFindingAction = useCallback(
    (claimId: string, action: TeacherAction, note?: string) =>
      commit((current) =>
        current
          ? persistTeacherFindingAction(current, claimId, action, note)
          : current,
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
    completeStudentReview,
    hydrated,
    getDossierRequest,
    saveDossier,
    saveStudentChallenge,
    saveTeacherFindingAction,
    session,
    saveReviewNote,
    setPendingFocus,
    startDefense,
  };
}
