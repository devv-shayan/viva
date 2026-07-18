"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { ConsentScreen } from "@/components/consent-screen";
import { DefenseRoom } from "@/components/defense-room";
import { StudentReview } from "@/components/student-review";
import { TeacherDossier } from "@/components/teacher-dossier";
import TeacherWorkflow from "@/components/teacher-workflow";
import { Button } from "@/components/ui/button";
import { WorkspaceBanner } from "@/components/workspace-banner";
import { useVivaDraft } from "@/components/viva-draft-provider";
import { useVivaSession } from "@/hooks/use-viva-session";
import type { Dossier } from "@/lib/dossier-types";

type VivaRole = "teacher" | "student";

type VivaFlowProps = {
  examinerInstructions: string;
  role: VivaRole;
  sampleEssay: string;
};

type BoundaryProps = {
  action?: { label: string; onClick: () => void };
  heading: string;
  message: string;
  role: VivaRole;
};

async function readJsonResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
}

function RoleBoundary({ action, heading, message, role }: BoundaryProps) {
  const tip =
    role === "student"
      ? "Your teacher prepares the essay before the student conversation can begin."
      : "Viva keeps the student conversation and the teacher summary as separate steps."

  return (
    <main className="grid min-h-screen place-items-center bg-[#ffffff] px-5 py-8 text-[#171717] sm:px-8">
      <div className="w-full max-w-xl">
        <WorkspaceBanner
          actions={
            action ? (
              <Button
                className="bg-[#171717] text-white hover:bg-[#303030]"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : null
          }
          audience={`${role} workspace`}
          description={message}
          tip={tip}
          title={heading}
        />
      </div>
    </main>
  );
}
export default function VivaFlow({
  examinerInstructions,
  role,
  sampleEssay,
}: VivaFlowProps) {
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const router = useRouter();
  const { clearDraft, draft, setDraft } = useVivaDraft();
  const {
    activateFocus,
    applyAssessment,
    appendRealtimeDiagnostic,
    appendTurn,
    clearSession,
    completeDefense,
    completeStudentReview,
    getDossierRequest,
    hydrated,
    saveDossier,
    saveReviewNote,
    saveTeacherFindingAction,
    session,
    setPendingFocus,
    startDefense,
  } = useVivaSession();

  async function generateDossier() {
    const dossierRequest = getDossierRequest();
    if (!dossierRequest || isGeneratingDossier) {
      return;
    }

    setDossierError(null);
    setIsGeneratingDossier(true);

    try {
      const response = await fetch("/api/dossier", {
        body: JSON.stringify(dossierRequest),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<Dossier & { error?: string }>(
        response,
        "Viva could not prepare the teacher summary. Please try again.",
      );

      if (!response.ok) {
        throw new Error(
          payload.error || "Viva could not prepare the teacher summary.",
        );
      }

      saveDossier(payload);
    } catch (error) {
      setDossierError(
        error instanceof Error
          ? error.message
          : "Viva could not prepare the teacher summary.",
      );
    } finally {
      setIsGeneratingDossier(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#ffffff] text-[#292824]">
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading your
          conversation record
        </p>
      </main>
    );
  }

  if (role === "student") {
    if (draft) {
      return (
        <ConsentScreen
          draft={draft}
          onBack={() => {
            clearDraft();
            router.push("/teacher");
          }}
          onBegin={() => {
            startDefense(draft);
            clearDraft();
          }}
        />
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

    if (session?.phase === "student_review") {
      return (
        <StudentReview
          onCompleteReview={() => {
            if (completeStudentReview()) {
              window.location.assign("/teacher");
            }
          }}
          onSaveNote={saveReviewNote}
          session={session}
        />
      );
    }

    return (
      <RoleBoundary
        heading="Your conversation is not ready yet"
        message="Your teacher will prepare the essay first. When they hand you the device, return to this page to read the short introduction and choose whether to begin."
        role="student"
      />
    );
  }

  if (session?.phase === "defense") {
    return (
      <RoleBoundary
        action={{
          label: "Open student workspace",
          onClick: () => window.location.assign("/student"),
        }}
        heading="The student is using this device"
        message="The live conversation stays in the student workspace. The teacher summary becomes available after the student has reviewed their conversation record."
        role="teacher"
      />
    );
  }

  if (session?.phase === "student_review") {
    const studentFinishedReview = Boolean(session.studentReviewCompletedAt);
    const hasRecordedConversation = session.transcript.turns.length > 0;

    return (
      <RoleBoundary
        action={
          studentFinishedReview && hasRecordedConversation
            ? {
                label: isGeneratingDossier
                  ? "Preparing teacher summary..."
                  : "Prepare teacher summary",
                onClick: generateDossier,
              }
            : studentFinishedReview
              ? {
                  label: "Start a new conversation",
                  onClick: () => {
                    clearSession();
                    clearDraft();
                  },
                }
              : undefined
        }
        heading={
          !studentFinishedReview
            ? "Waiting for the student to finish their review"
            : hasRecordedConversation
              ? "Student review is complete"
              : "No conversation was recorded"
        }
        message={
          dossierError ??
          (!studentFinishedReview
            ? "Hand the device to the student. They must select Finish review after reading the conversation record before the teacher summary becomes available."
            : hasRecordedConversation
              ? "The student has checked the conversation record. You can now prepare the evidence summary."
              : "The student finished their review, but no questions or answers were saved. Viva cannot make an evidence summary without a conversation record. Start a new conversation to continue.")
        }
        role="teacher"
      />
    );
  }

  if (session?.phase === "dossier" && session.dossier) {
    return (
      <TeacherDossier
        onClear={() => {
          clearSession();
          clearDraft();
        }}
        onSaveFindingAction={saveTeacherFindingAction}
        session={session}
      />
    );
  }

  return (
    <TeacherWorkflow
      initialDraft={null}
      onStartDefense={(nextDraft) => {
        setDraft(nextDraft);
        router.push("/student");
      }}
      sampleEssay={sampleEssay}
    />
  );
}
