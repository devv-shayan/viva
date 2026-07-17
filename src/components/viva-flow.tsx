"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { ConsentScreen } from "@/components/consent-screen";
import { DefenseRoom } from "@/components/defense-room";
import { StudentReview } from "@/components/student-review";
import TeacherWorkflow from "@/components/teacher-workflow";
import { useVivaSession } from "@/hooks/use-viva-session";
import type { DefenseDraft } from "@/lib/session-state";

type VivaFlowProps = {
  examinerInstructions: string;
  sampleEssay: string;
};

export default function VivaFlow({
  examinerInstructions,
  sampleEssay,
}: VivaFlowProps) {
  const [draft, setDraft] = useState<DefenseDraft | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const {
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
  } = useVivaSession();

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f3ed] text-[#413d35]">
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Restoring the consented defense record…
        </p>
      </main>
    );
  }

  if (session?.phase === "defense") {
    return (
      <DefenseRoom
        examinerInstructions={examinerInstructions}
        onActivateFocus={activateFocus}
        onApplyAssessment={applyAssessment}
        onAppendRealtimeDiagnostic={appendRealtimeDiagnostic}
        onAppendTurn={appendTurn}
        onComplete={completeDefense}
        onSetPendingFocus={setPendingFocus}
        session={session}
      />
    );
  }

  if (session?.phase === "student_review" || session?.phase === "dossier") {
    return (
      <StudentReview
        onReturnToTeacher={() => {
          clearSession();
          setDraft(null);
          setShowConsent(false);
        }}
        onSaveNote={(note) => {
          saveReviewNote(note);
        }}
        session={session}
      />
    );
  }

  if (showConsent && draft) {
    return (
      <ConsentScreen
        draft={draft}
        onBack={() => setShowConsent(false)}
        onBegin={() => {
          startDefense(draft);
          setShowConsent(false);
        }}
      />
    );
  }

  return (
    <TeacherWorkflow
      initialDraft={draft}
      onStartDefense={(nextDraft) => {
        setDraft(nextDraft);
        setShowConsent(true);
      }}
      sampleEssay={sampleEssay}
    />
  );
}
