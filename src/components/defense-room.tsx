"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  backgroundResult,
  RealtimeAgent,
  RealtimeSession,
  tool,
} from "@openai/agents/realtime";
import {
  Check,
  CircleAlert,
  Clock3,
  FileText,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { z } from "zod";

import { PassageDocument } from "@/components/passage-document";
import { Button } from "@/components/ui/button";
import { WorkspaceBanner } from "@/components/workspace-banner";
import {
  createAssessLatencyMetrics,
  requestAssessment,
} from "@/lib/assess-client";
import { createAssessmentRequestGuard } from "@/lib/assess-request-guard";
import type { AssessDelta } from "@/lib/assess-types";
import {
  getDefenseElapsedMs,
  isDefenseTimeExpired,
  pauseDefenseClock,
  resumeDefenseClock,
  type DefenseClock,
} from "@/lib/defense-clock";
import { vivaModels } from "@/lib/models";
import { nextFallbackFocus, nextFocus, type NextFocus } from "@/lib/orchestrator";
import {
  consumePauseFocusRecovery,
  createPauseRecoveryState,
  markAgentResponseRequested,
  markPauseOwnedResponseStarted,
  markPauseInterruptRequested,
  recordRealtimeResponseDone,
} from "@/lib/pause-recovery";
import { requireStableTranscriptItemId } from "@/lib/realtime-transcript";
import {
  getRealtimeResponseDiagnostic,
  type RealtimeResponse,
} from "@/lib/realtime-session";
import {
  createFocusForClaim,
  createPreviewNextFocus,
  answerGroupIdForQuestionTurn,
  formatFocus,
  shouldResumeDefense,
  type Focus,
  type RealtimeResponseDiagnostic,
  type TranscriptAppendOptions,
  type TranscriptTurn,
  type VivaSessionState,
} from "@/lib/session-state";
import { ASSESS_HICCUP_MESSAGE, TRUST_PROMISES } from "@/lib/trust-contract";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type TokenResponse = {
  clientSecret?: string;
  error?: string;
};

type RawRealtimeEvent = {
  error?: { message?: string } | string;
  item_id?: string;
  response?: RealtimeResponse;
  transcript?: string;
  type: string;
};

type DefenseRoomProps = {
  examinerInstructions: string;
  onActivateFocus: () => VivaSessionState | null;
  onApplyAssessment: (
    delta: AssessDelta,
    answerGroupId?: string,
  ) => VivaSessionState | null;
  onAppendRealtimeDiagnostic: (
    diagnostic: RealtimeResponseDiagnostic,
  ) => VivaSessionState | null;
  onAppendTurn: (
    turn: TranscriptTurn,
    options?: TranscriptAppendOptions,
  ) => VivaSessionState | null;
  onComplete: () => VivaSessionState | null;
  onSetPendingFocus: (focus: Focus | undefined) => VivaSessionState | null;
  session: VivaSessionState;
};

type PendingAssessment = {
  activeFocus: Focus;
  afterAnswer: VivaSessionState;
  answerGroupId: string;
  answerTurns: TranscriptTurn[];
  routeAfterAssessment: boolean;
};

type OpenAnswerGroup = {
  claimId: string;
  focus: Focus;
  id: string;
};

const FINAL_AUDIO_DRAIN_TIMEOUT_MS = 8_000;
const FINAL_AUDIO_PLAYOUT_GRACE_MS = 350;
export const ANSWER_GROUP_SETTLE_MS = 1_200;
const RESUME_FOCUS_INSTRUCTION =
  "[RESUME] This is a reconnection of a consented defense. Consent has already been spoken. Do not repeat consent, greet the student, or add a preamble. Ask exactly one concise question for this FOCUS. Quote at most twelve words; paraphrase anything longer.";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function displayTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function focusMoveLabel(move: Focus["move"]) {
  const labels: Record<Focus["move"], string> = {
    grounded_question: "Starting point",
    drill_down: "A little deeper",
    counterfactual: "Consider another view",
    wrap: "Bringing it together",
  };

  return labels[move];
}

function focusForWrap(session: VivaSessionState) {
  return createFocusForClaim(
    session.graph,
    session.activeFocus?.claimId ?? session.graph.thesis.id,
    "wrap",
  );
}

function diagnosticForPersistence(
  response: RealtimeResponse | null | undefined,
  t: number,
): RealtimeResponseDiagnostic | null {
  const responseId = response?.id?.trim();
  const status = response?.status;

  if (
    !responseId ||
    (status !== "incomplete" && status !== "failed")
  ) {
    return null;
  }

  return {
    responseId,
    status,
    reason: response?.status_details?.reason ?? undefined,
    outputTokens: response?.usage?.output_tokens ?? undefined,
    audioOutputTokens:
      response?.usage?.output_token_details?.audio_tokens ?? undefined,
    textOutputTokens:
      response?.usage?.output_token_details?.text_tokens ?? undefined,
    t,
  };
}

export function DefenseRoom({
  examinerInstructions,
  onActivateFocus,
  onApplyAssessment,
  onAppendRealtimeDiagnostic,
  onAppendTurn,
  onComplete,
  onSetPendingFocus,
  session,
}: DefenseRoomProps) {
  const realtimeRef = useRef<RealtimeSession | null>(null);
  const sessionStateRef = useRef(session);
  const studentItemIdsRef = useRef(new Set<string>());
  const agentItemIdsRef = useRef(new Set<string>());
  const focusSequenceRef = useRef(Promise.resolve());
  const defenseClockRef = useRef<DefenseClock>({
    connectionOffsetMs: 0,
    connectionStartedAtMs: null,
    pausedMs: 0,
    pauseStartedAtMs: null,
  });
  const endRequestedRef = useRef(false);
  const finishedRef = useRef(false);
  const awaitingFinalAudioRef = useRef(false);
  const finalAudioBufferDrainedRef = useRef(false);
  const finalAudioDrainTimeoutRef = useRef<number | null>(null);
  const finalAudioFinishTimerRef = useRef<number | null>(null);
  const connectionAttemptRef = useRef(0);
  const pauseRecoveryRef = useRef(createPauseRecoveryState());
  const pauseAwaitingResponseStartRef = useRef(false);
  const isPausedRef = useRef(false);
  const focusRequestGenerationRef = useRef(0);
  const deferredFocusAfterPauseRef = useRef<{
    focus: Focus;
    resume: boolean;
  } | null>(null);
  const queuedFocusRequestRef = useRef<{
    focus: Focus;
    generation: number;
    resume: boolean;
  } | null>(null);
  const deferredAssessmentAfterPauseRef = useRef<PendingAssessment | null>(
    null,
  );
  const assessMetricsRef = useRef(createAssessLatencyMetrics());
  const assessmentGuardRef = useRef(createAssessmentRequestGuard());
  const assessmentAbortControllerRef = useRef<AbortController | null>(null);
  const assessmentInFlightRef = useRef(false);
  const fallbackAfterPausedAssessmentRef = useRef(false);
  const openAnswerGroupRef = useRef<OpenAnswerGroup | null>(null);
  const answerGroupSettleTimerRef = useRef<number | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, ...session.transcript.turns.map((turn) => turn.t)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isFinalizingAnswer, setIsFinalizingAnswer] = useState(false);
  const [shouldReaskFocusAfterPause, setShouldReaskFocusAfterPause] =
    useState(false);

  useEffect(() => {
    sessionStateRef.current = session;
  }, [session]);

  const timestamp = useCallback(() => {
    return getDefenseElapsedMs(defenseClockRef.current, performance.now());
  }, []);

  const cancelPendingAssessment = useCallback(
    ({ continueAfterPause = false }: { continueAfterPause?: boolean } = {}) => {
      const wasAssessing = assessmentInFlightRef.current;

      assessmentGuardRef.current.invalidate();
      assessmentAbortControllerRef.current?.abort();
      assessmentAbortControllerRef.current = null;
      assessmentInFlightRef.current = false;
      setIsAssessing(false);

      if (continueAfterPause && wasAssessing) {
        fallbackAfterPausedAssessmentRef.current = true;
      }

      return wasAssessing;
    },
    [],
  );

  const clearAnswerGroupSettleTimer = useCallback(() => {
    if (answerGroupSettleTimerRef.current !== null) {
      window.clearTimeout(answerGroupSettleTimerRef.current);
      answerGroupSettleTimerRef.current = null;
    }

    setIsFinalizingAnswer(false);
  }, []);

  const closeOpenAnswerGroup = useCallback(() => {
    clearAnswerGroupSettleTimer();
    openAnswerGroupRef.current = null;
  }, [clearAnswerGroupSettleTimer]);

  const clearFinalAudioTimers = useCallback(() => {
    if (finalAudioDrainTimeoutRef.current !== null) {
      window.clearTimeout(finalAudioDrainTimeoutRef.current);
      finalAudioDrainTimeoutRef.current = null;
    }

    if (finalAudioFinishTimerRef.current !== null) {
      window.clearTimeout(finalAudioFinishTimerRef.current);
      finalAudioFinishTimerRef.current = null;
    }
  }, []);

  const finishAndReview = useCallback(
    (
      message?: string,
      { interrupt = true }: { interrupt?: boolean } = {},
    ) => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      connectionAttemptRef.current += 1;
      focusRequestGenerationRef.current += 1;
      isPausedRef.current = false;
      pauseAwaitingResponseStartRef.current = false;
      deferredFocusAfterPauseRef.current = null;
      queuedFocusRequestRef.current = null;
      deferredAssessmentAfterPauseRef.current = null;
      fallbackAfterPausedAssessmentRef.current = false;
      cancelPendingAssessment();
      closeOpenAnswerGroup();
      awaitingFinalAudioRef.current = false;
      clearFinalAudioTimers();
      const realtime = realtimeRef.current;

      if (realtime) {
        if (interrupt) {
          realtime.interrupt();
        }
        realtime.close();
      }

      realtimeRef.current = null;
      setConnectionStatus("idle");
      setIsPaused(false);
      setIsFinishing(false);

      if (message) {
        setError(message);
      }

      onComplete();
    },
    [
      cancelPendingAssessment,
      clearFinalAudioTimers,
      closeOpenAnswerGroup,
      onComplete,
    ],
  );

  const completeAfterFinalAudio = useCallback(() => {
    if (
      finishedRef.current ||
      !awaitingFinalAudioRef.current ||
      finalAudioFinishTimerRef.current !== null
    ) {
      return;
    }

    finalAudioFinishTimerRef.current = window.setTimeout(() => {
      finalAudioFinishTimerRef.current = null;
      finishAndReview(undefined, { interrupt: false });
    }, FINAL_AUDIO_PLAYOUT_GRACE_MS);
  }, [finishAndReview]);

  const finishAfterFinalAudio = useCallback(() => {
    if (finishedRef.current || awaitingFinalAudioRef.current) {
      return;
    }

    awaitingFinalAudioRef.current = true;
    setIsFinishing(true);

    if (finalAudioBufferDrainedRef.current) {
      completeAfterFinalAudio();
      return;
    }

    finalAudioDrainTimeoutRef.current = window.setTimeout(() => {
      finalAudioDrainTimeoutRef.current = null;
      finishAndReview(undefined, { interrupt: false });
    }, FINAL_AUDIO_DRAIN_TIMEOUT_MS);
  }, [completeAfterFinalAudio, finishAndReview]);

  const requestReplyForFocus = useCallback(
    (focus: Focus, { resume = false }: { resume?: boolean } = {}) => {
      const queuedGeneration = focusRequestGenerationRef.current;
      queuedFocusRequestRef.current = {
        focus,
        generation: queuedGeneration,
        resume,
      };

      const request = focusSequenceRef.current
        .catch(() => undefined)
        .then(() => {
          if (endRequestedRef.current || finishedRef.current) {
            return;
          }

          if (isPausedRef.current) {
            deferredFocusAfterPauseRef.current = { focus, resume };

            if (queuedFocusRequestRef.current?.focus === focus) {
              queuedFocusRequestRef.current = null;
            }

            return;
          }

          if (queuedGeneration !== focusRequestGenerationRef.current) {
            return;
          }

          const realtime = realtimeRef.current;

          if (!realtime) {
            return;
          }

          const activated = onActivateFocus();

          if (!activated) {
            setError("The consented defense session is no longer available.");
            return;
          }

          sessionStateRef.current = activated;

          if (queuedFocusRequestRef.current?.focus === focus) {
            queuedFocusRequestRef.current = null;
          }

          const focusInstruction = formatFocus(focus, activated.graph);

          realtime.transport.sendEvent({
            type: "conversation.item.create",
            item: {
              content: [
                {
                  text: resume
                    ? `${focusInstruction}\n${RESUME_FOCUS_INSTRUCTION}`
                    : focusInstruction,
                  type: "input_text",
                },
              ],
              role: "system",
              type: "message",
            },
          });

          // FOCUS correctness relies on ordered transport delivery: this
          // conversation.item.create must arrive before the response request.
          // focusSequence serializes client-side sends only; there is no server
          // acknowledgement here. If a response is ever observed ignoring its
          // FOCUS, harden this seam by awaiting conversation.item.created first.
          pauseRecoveryRef.current = markAgentResponseRequested(
            pauseRecoveryRef.current,
          );

          if (realtime.transport.requestResponse) {
            realtime.transport.requestResponse();
          } else {
            realtime.transport.sendEvent({ type: "response.create" });
          }
        })
        .catch((requestError) => {
          setConnectionStatus("error");
          setError(errorMessage(requestError));
        });

      focusSequenceRef.current = request;
    },
    [onActivateFocus],
  );

  const scheduleNextFocus = useCallback(
    (
      candidate: NextFocus,
      { resume = false }: { resume?: boolean } = {},
    ) => {
      const current = sessionStateRef.current;
      const focus = candidate === "wrap" ? focusForWrap(current) : candidate;

      if (!focus) {
        finishAndReview();
        return;
      }

      const withPendingFocus = onSetPendingFocus(focus);

      if (!withPendingFocus) {
        return;
      }

      sessionStateRef.current = withPendingFocus;
      requestReplyForFocus(focus, { resume });
    },
    [finishAndReview, onSetPendingFocus, requestReplyForFocus],
  );

  const startAssessment = useCallback(
    ({
      activeFocus,
      afterAnswer,
      answerGroupId,
      answerTurns,
      routeAfterAssessment,
    }: PendingAssessment) => {
      if (isPausedRef.current) {
        deferredAssessmentAfterPauseRef.current = {
          activeFocus,
          afterAnswer,
          answerGroupId,
          answerTurns,
          routeAfterAssessment,
        };
        return;
      }

      // A final transcription may arrive twice or land after a reconnect.
      // Only one assessment may spend credit or choose the next FOCUS.
      cancelPendingAssessment();
      const assessmentToken = assessmentGuardRef.current.begin();
      const controller = new AbortController();
      assessmentAbortControllerRef.current = controller;
      assessmentInFlightRef.current = true;
      setIsAssessing(true);

      void (async () => {
        try {
          const { delta } = await requestAssessment(
            {
              answerTurns,
              focus: activeFocus,
              graph: afterAnswer.graph,
              recentTurns: afterAnswer.transcript.turns.slice(-6),
            },
            {
              metrics: assessMetricsRef.current,
              onMetrics: (metrics) => {
                if (assessmentGuardRef.current.isCurrent(assessmentToken)) {
                  assessMetricsRef.current = metrics;
                }
              },
              signal: controller.signal,
            },
          );

          if (!assessmentGuardRef.current.isCurrent(assessmentToken)) {
            return;
          }

          const assessed = onApplyAssessment(delta, answerGroupId);

          if (!assessed) {
            return;
          }

          sessionStateRef.current = assessed;
          if (
            routeAfterAssessment &&
            sessionStateRef.current.activeFocus?.claimId === activeFocus.claimId
          ) {
            scheduleNextFocus(
              nextFocus(assessed.coverage, assessed.graph, timestamp()),
            );
          }
        } catch {
          if (!assessmentGuardRef.current.isCurrent(assessmentToken)) {
            return;
          }

          setError(ASSESS_HICCUP_MESSAGE);
          if (
            routeAfterAssessment &&
            sessionStateRef.current.activeFocus?.claimId === activeFocus.claimId
          ) {
            const current = sessionStateRef.current;
            scheduleNextFocus(
              nextFallbackFocus(current.coverage, current.graph, timestamp()),
            );
          }
        } finally {
          if (assessmentGuardRef.current.isCurrent(assessmentToken)) {
            assessmentInFlightRef.current = false;

            if (assessmentAbortControllerRef.current === controller) {
              assessmentAbortControllerRef.current = null;
            }

            setIsAssessing(false);
          }
        }
      })();
    },
    [cancelPendingAssessment, onApplyAssessment, scheduleNextFocus, timestamp],
  );

  const queueAssessmentForOpenGroup = useCallback(
    (group: OpenAnswerGroup) => {
      clearAnswerGroupSettleTimer();
      setIsFinalizingAnswer(true);

      answerGroupSettleTimerRef.current = window.setTimeout(() => {
        answerGroupSettleTimerRef.current = null;
        setIsFinalizingAnswer(false);

        if (openAnswerGroupRef.current?.id !== group.id) {
          return;
        }

        const afterAnswer = sessionStateRef.current;
        const persistedGroup = afterAnswer.coverage
          .find((entry) => entry.claimId === group.claimId)
          ?.answerGroups.find((entry) => entry.id === group.id);
        const turnsById = new Map(
          afterAnswer.transcript.turns.map((turn) => [turn.id, turn]),
        );
        const answerTurns = (persistedGroup?.answerTurnIds ?? []).flatMap(
          (turnId) => {
            const turn = turnsById.get(turnId);
            return turn?.speaker === "student" ? [turn] : [];
          },
        );

        if (answerTurns.length === 0) {
          return;
        }

        startAssessment({
          activeFocus: group.focus,
          afterAnswer,
          answerGroupId: group.id,
          answerTurns,
          // A queued FOCUS is not a turn boundary. A late ASR fragment stays
          // with this group until Realtime creates the next Viva response.
          routeAfterAssessment:
            afterAnswer.activeFocus?.claimId === group.claimId,
        });
      }, ANSWER_GROUP_SETTLE_MS);
    },
    [clearAnswerGroupSettleTimer, startAssessment],
  );

  useEffect(() => {
    if (
      isPaused ||
      !shouldReaskFocusAfterPause ||
      connectionStatus !== "connected" ||
      endRequestedRef.current ||
      finishedRef.current
    ) {
      return;
    }

    const recovery = consumePauseFocusRecovery(pauseRecoveryRef.current);
    pauseRecoveryRef.current = recovery.state;
    setShouldReaskFocusAfterPause(false);

    if (!recovery.shouldReaskFocus) {
      return;
    }

    const current = sessionStateRef.current;
    const focus = current.activeFocus ?? current.pendingFocus;

    if (focus) {
      requestReplyForFocus(focus, { resume: true });
    }
  }, [connectionStatus, isPaused, requestReplyForFocus, shouldReaskFocusAfterPause]);

  const handleStudentTranscript = useCallback(
    (itemId: string, transcript: string) => {
      const text = transcript.trim();

      if (!text || studentItemIdsRef.current.has(itemId) || endRequestedRef.current) {
        return;
      }

      studentItemIdsRef.current.add(itemId);
      const group = openAnswerGroupRef.current;
      const afterAnswer = onAppendTurn({
        id: itemId,
        speaker: "student",
        t: timestamp(),
        text,
      }, group
        ? {
            answerGroupClaimId: group.claimId,
            answerGroupId: group.id,
          }
        : undefined);

      if (!afterAnswer) {
        return;
      }

      sessionStateRef.current = afterAnswer;
      const answerTurn = afterAnswer.transcript.turns.find(
        (turn) => turn.id === itemId,
      );

      if (!answerTurn || !group) {
        return;
      }

      const persistedGroup = afterAnswer.coverage
        .find((entry) => entry.claimId === group.claimId)
        ?.answerGroups.find((entry) => entry.id === group.id);

      if (!persistedGroup?.answerTurnIds.includes(answerTurn.id)) {
        return;
      }

      // A second final event before Viva starts its next turn extends this
      // answer rather than being assessed as an unrelated fragment.
      cancelPendingAssessment();
      queueAssessmentForOpenGroup(group);
    },
    [
      cancelPendingAssessment,
      onAppendTurn,
      queueAssessmentForOpenGroup,
      timestamp,
    ],
  );

  const handleAgentTranscript = useCallback(
    (itemId: string, transcript: string) => {
      const text = transcript.trim();

      if (!text || agentItemIdsRef.current.has(itemId)) {
        return;
      }

      agentItemIdsRef.current.add(itemId);
      const focusForQuestion = sessionStateRef.current.activeFocus;
      const afterQuestion = onAppendTurn({
        id: itemId,
        speaker: "agent",
        t: timestamp(),
        text,
      });

      if (afterQuestion) {
        sessionStateRef.current = afterQuestion;

        if (focusForQuestion) {
          const groupId = answerGroupIdForQuestionTurn(itemId);
          const persistedGroup = afterQuestion.coverage
            .find((entry) => entry.claimId === focusForQuestion.claimId)
            ?.answerGroups.find((entry) => entry.id === groupId);

          if (persistedGroup) {
            openAnswerGroupRef.current = {
            claimId: focusForQuestion.claimId,
            focus: focusForQuestion,
            id: groupId,
          };
          }
        }
      }
    },
    [onAppendTurn, timestamp],
  );

  const connect = useCallback(async () => {
    const connectionAttempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = connectionAttempt;
    focusRequestGenerationRef.current += 1;
    isPausedRef.current = false;
    pauseAwaitingResponseStartRef.current = false;
    deferredFocusAfterPauseRef.current = null;
    queuedFocusRequestRef.current = null;
    deferredAssessmentAfterPauseRef.current = null;
    cancelPendingAssessment();
    closeOpenAnswerGroup();
    fallbackAfterPausedAssessmentRef.current = false;

    if (realtimeRef.current) {
      realtimeRef.current.close();
      realtimeRef.current = null;
    }

    clearFinalAudioTimers();
    setConnectionStatus("connecting");
    setError(null);
    setIsPaused(false);
    setIsFinishing(false);
    endRequestedRef.current = false;
    finishedRef.current = false;
    awaitingFinalAudioRef.current = false;
    finalAudioBufferDrainedRef.current = false;
    studentItemIdsRef.current.clear();
    agentItemIdsRef.current.clear();
    focusSequenceRef.current = Promise.resolve();
    pauseRecoveryRef.current = createPauseRecoveryState();
    setShouldReaskFocusAfterPause(false);
    const connectionOffsetMs = Math.max(
      0,
      ...sessionStateRef.current.transcript.turns.map((turn) => turn.t),
    );
    const connectionStartedAtMs = performance.now();
    defenseClockRef.current = {
      connectionOffsetMs,
      connectionStartedAtMs,
      pausedMs: 0,
      pauseStartedAtMs: null,
    };
    setElapsedMs(connectionOffsetMs);

    let realtime: RealtimeSession | null = null;

    try {
      const tokenResponse = await fetch("/api/realtime-token", {
        cache: "no-store",
        method: "POST",
      });
      const token = (await tokenResponse.json()) as TokenResponse;

      if (connectionAttempt !== connectionAttemptRef.current) {
        return;
      }

      if (!tokenResponse.ok || typeof token.clientSecret !== "string") {
        throw new Error(token.error ?? "The Realtime token request failed.");
      }

      const endDefenseTool = tool({
        description:
          "End the defense only after you have spoken the warm wrap-up described in your instructions.",
        name: "end_defense",
        parameters: z.object({}).strict(),
        execute: () => {
          endRequestedRef.current = true;
          setIsFinishing(true);
          return backgroundResult(
            "The spoken wrap-up is complete. Do not ask another question.",
          );
        },
      });

      const agent = new RealtimeAgent({
        instructions: examinerInstructions,
        name: "Viva Examiner",
        tools: [endDefenseTool],
      });

      realtime = new RealtimeSession(agent, {
        config: {
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe" },
              turnDetection: {
                createResponse: false,
                interruptResponse: false,
                type: "semantic_vad",
              },
            },
          },
          outputModalities: ["audio"],
          reasoning: { effort: "low" },
        },
        model: vivaModels.realtime,
        tracingDisabled: true,
      });

      realtime.transport.on("*", (event) => {
        if (
          connectionAttempt !== connectionAttemptRef.current ||
          realtimeRef.current !== realtime
        ) {
          return;
        }

        const raw = event as RawRealtimeEvent;

        if (raw.type === "output_audio_buffer.started") {
          // The prior answer remains open until Viva's next audio actually
          // begins. A queued FOCUS or a server-side response.created event is
          // not enough: late final ASR fragments still belong to the answer
          // the student just gave until the next question starts speaking.
          closeOpenAnswerGroup();
          finalAudioBufferDrainedRef.current = false;
          return;
        }

        if (
          raw.type === "output_audio_buffer.stopped" ||
          raw.type === "output_audio_buffer.cleared"
        ) {
          finalAudioBufferDrainedRef.current = true;
          completeAfterFinalAudio();
          return;
        }

        if (raw.type === "response.created") {
          if (
            isPausedRef.current &&
            pauseAwaitingResponseStartRef.current
          ) {
            pauseAwaitingResponseStartRef.current = false;
            pauseRecoveryRef.current = markPauseOwnedResponseStarted(
              pauseRecoveryRef.current,
            );

            // Let the SDK observe response.created before it serializes the
            // cancellation; otherwise interrupt() may see no active response.
            queueMicrotask(() => {
              const activeRealtime = realtimeRef.current;

              if (
                isPausedRef.current &&
                activeRealtime &&
                activeRealtime === realtime &&
                connectionAttempt === connectionAttemptRef.current
              ) {
                activeRealtime.interrupt();
              }
            });
          }

          return;
        }

        if (raw.type === "response.done") {
          pauseAwaitingResponseStartRef.current = false;
          pauseRecoveryRef.current = recordRealtimeResponseDone(
            pauseRecoveryRef.current,
            raw.response,
          );

          if (pauseRecoveryRef.current.shouldReaskFocus) {
            setShouldReaskFocusAfterPause(true);
          }

          const diagnostic = getRealtimeResponseDiagnostic(raw.response);
          const persistedDiagnostic = diagnosticForPersistence(
            raw.response,
            timestamp(),
          );

          if (persistedDiagnostic) {
            const updated = onAppendRealtimeDiagnostic(persistedDiagnostic);

            if (updated) {
              sessionStateRef.current = updated;
            }
          }

          if (diagnostic) {
            console.warn("Realtime response did not complete", {
              responseId: raw.response?.id,
              outputTokens: raw.response?.usage?.output_tokens,
              reason: raw.response?.status_details?.reason,
              status: raw.response?.status,
            });
            setError(diagnostic);
          }

          return;
        }

        if (
          raw.type ===
          "conversation.item.input_audio_transcription.completed"
        ) {
          const itemId = requireStableTranscriptItemId(raw);

          if (!itemId) {
            return;
          }

          handleStudentTranscript(
            itemId,
            raw.transcript ?? "",
          );
          return;
        }

        if (raw.type === "response.output_audio_transcript.done") {
          const itemId = requireStableTranscriptItemId(raw);

          if (!itemId) {
            return;
          }

          handleAgentTranscript(
            itemId,
            raw.transcript ?? "",
          );
          return;
        }

        if (raw.type === "error") {
          const eventError = raw.error;
          const message =
            typeof eventError === "string"
              ? eventError
              : eventError?.message ?? "The Realtime connection reported an error.";

          setConnectionStatus("error");
          setError(message);
        }
      });

      realtime.on("agent_end", () => {
        if (
          connectionAttempt !== connectionAttemptRef.current ||
          realtimeRef.current !== realtime
        ) {
          return;
        }

        if (endRequestedRef.current) {
          finishAfterFinalAudio();
        }
      });

      realtimeRef.current = realtime;
      await realtime.connect({ apiKey: token.clientSecret });

      if (connectionAttempt !== connectionAttemptRef.current) {
        realtime.close();

        if (realtimeRef.current === realtime) {
          realtimeRef.current = null;
        }

        return;
      }

      setConnectionStatus("connected");

      const current = sessionStateRef.current;
      const openingFocus =
        current.pendingFocus ??
        current.activeFocus ??
        createPreviewNextFocus(current) ??
        focusForWrap(current);

      if (!openingFocus) {
        finishAndReview();
        return;
      }

      requestReplyForFocus(openingFocus, {
        resume: shouldResumeDefense(current),
      });
    } catch (connectError) {
      if (connectionAttempt !== connectionAttemptRef.current) {
        return;
      }

      realtime?.close();

      if (realtimeRef.current === realtime) {
        realtimeRef.current = null;
      }

      clearFinalAudioTimers();
      setConnectionStatus("error");
      setError(errorMessage(connectError));
    }
  }, [
    examinerInstructions,
    cancelPendingAssessment,
    closeOpenAnswerGroup,
    clearFinalAudioTimers,
    completeAfterFinalAudio,
    finishAndReview,
    finishAfterFinalAudio,
    handleAgentTranscript,
    handleStudentTranscript,
    onAppendRealtimeDiagnostic,
    requestReplyForFocus,
    timestamp,
  ]);

  const togglePause = useCallback(() => {
    const realtime = realtimeRef.current;

    if (!realtime || connectionStatus !== "connected") {
      return;
    }

    const shouldPause = !isPausedRef.current;
    const nowMs = performance.now();

    if (shouldPause) {
      // Set this fence before interrupting transport work: a queued FOCUS or
      // late final transcript must wait for an explicit resume.
      isPausedRef.current = true;
      realtime.mute(true);
      setIsPaused(true);
      const queuedFocus = queuedFocusRequestRef.current;

      if (queuedFocus) {
        deferredFocusAfterPauseRef.current = {
          focus: queuedFocus.focus,
          resume: queuedFocus.resume,
        };
        queuedFocusRequestRef.current = null;
      }

      focusRequestGenerationRef.current += 1;
      cancelPendingAssessment({ continueAfterPause: true });
      defenseClockRef.current = pauseDefenseClock(
        defenseClockRef.current,
        nowMs,
      );
      pauseAwaitingResponseStartRef.current =
        pauseRecoveryRef.current.agentResponseInFlight;
      pauseRecoveryRef.current = markPauseInterruptRequested(
        pauseRecoveryRef.current,
      );
      setShouldReaskFocusAfterPause(false);
      realtime.interrupt();
      return;
    } else {
      defenseClockRef.current = resumeDefenseClock(
        defenseClockRef.current,
        nowMs,
      );
      setElapsedMs(getDefenseElapsedMs(defenseClockRef.current, nowMs));

      isPausedRef.current = false;
      realtime.mute(false);
      setIsPaused(false);

      const deferredAssessment = deferredAssessmentAfterPauseRef.current;

      if (deferredAssessment) {
        deferredAssessmentAfterPauseRef.current = null;
        pauseAwaitingResponseStartRef.current = false;
        pauseRecoveryRef.current = createPauseRecoveryState();
        startAssessment(deferredAssessment);
        return;
      }

      if (fallbackAfterPausedAssessmentRef.current) {
        fallbackAfterPausedAssessmentRef.current = false;
        pauseAwaitingResponseStartRef.current = false;
        pauseRecoveryRef.current = createPauseRecoveryState();
        setShouldReaskFocusAfterPause(false);
        const current = sessionStateRef.current;
        scheduleNextFocus(
          nextFallbackFocus(current.coverage, current.graph, timestamp()),
          { resume: true },
        );
        return;
      }

      const deferredFocus = deferredFocusAfterPauseRef.current;

      if (deferredFocus) {
        deferredFocusAfterPauseRef.current = null;
        pauseAwaitingResponseStartRef.current = false;
        pauseRecoveryRef.current = createPauseRecoveryState();
        setShouldReaskFocusAfterPause(false);
        requestReplyForFocus(deferredFocus.focus, {
          resume: deferredFocus.resume,
        });
      }

      return;
    }
  }, [
    cancelPendingAssessment,
    connectionStatus,
    requestReplyForFocus,
    scheduleNextFocus,
    startAssessment,
    timestamp,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowMs = performance.now();
      const clock = defenseClockRef.current;

      if (clock.connectionStartedAtMs === null || finishedRef.current) {
        return;
      }

      const nextElapsed = getDefenseElapsedMs(clock, nowMs);
      setElapsedMs(nextElapsed);

      if (isDefenseTimeExpired(clock, nowMs)) {
        finishAndReview("The five-minute conversation limit has ended.");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finishAndReview]);

  useEffect(() => {
    return () => {
      connectionAttemptRef.current += 1;
      focusRequestGenerationRef.current += 1;
      isPausedRef.current = false;
      pauseAwaitingResponseStartRef.current = false;
      deferredFocusAfterPauseRef.current = null;
      queuedFocusRequestRef.current = null;
      deferredAssessmentAfterPauseRef.current = null;
      cancelPendingAssessment();
      closeOpenAnswerGroup();
      clearFinalAudioTimers();
      realtimeRef.current?.close();
      realtimeRef.current = null;
    };
  }, [cancelPendingAssessment, clearFinalAudioTimers, closeOpenAnswerGroup]);

  const activeFocus = session.activeFocus ?? session.pendingFocus;
  const highlights = activeFocus
    ? [{ ...activeFocus.passage, label: "Viva's current focus" }]
    : [];
  const claims = [session.graph.thesis, ...session.graph.claims];
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const isResumingDefense = shouldResumeDefense(session);

  return (
    <main className="min-h-screen bg-[#ffffff] px-4 py-5 text-[#171717] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[96rem]">
        <WorkspaceBanner
          actions={
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e7e3d8] bg-white px-3 py-2 text-sm text-[#554e43]">
                <Clock3 className="size-4 text-[#746a5b]" /> {displayTime(elapsedMs)} / 5:00
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${
                  isConnected
                    ? "bg-[#fff8dc] text-[#171717]"
                    : connectionStatus === "error"
                      ? "bg-[#fff8dc] text-[#5f5018]"
                      : "bg-[#ece7dd] text-[#625a4d]"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isConnected ? "bg-[#2e7a56]" : "bg-[#9c907f]"
                  }`}
                />
                {isPaused ? "Paused" : connectionStatus}
              </span>
            </>
          }
          audience="Student workspace"
          description="Explain the highlighted part of the essay in your own words. Viva only asks about ideas that are on the page."
          tip="Take your time. You can pause if you need a moment before you answer."
          title="Explain what you mean."
        />
        <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
          <article className="rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-5 shadow-[0_14px_35px_rgba(70,55,30,0.05)] sm:p-7">
            <div className="flex flex-col gap-3 border-b border-[#eeeae2] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                  <FileText className="size-3.5" /> Essay
                </div>
                <p className="mt-2 font-serif text-xl leading-7 text-[#292824]">
                  {activeFocus
                    ? "Viva is asking about the highlighted text right now."
                    : "Viva will highlight the part of the essay it is discussing."}
                </p>
              </div>
              {activeFocus ? (
                <span className="w-fit bg-[#FBE994] px-3 py-2 text-xs font-semibold tracking-[0.1em] text-[#5f5018] uppercase">
                  {focusMoveLabel(activeFocus.move)}
                </span>
              ) : null}
            </div>

            <PassageDocument
              className="mt-6 space-y-6"
              highlights={highlights}
              submission={session.submission}
            />
          </article>

          <aside className="rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] p-5 xl:sticky xl:top-5 xl:h-fit">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
              Topics we&apos;ve discussed
            </p>
            <p className="mt-2 text-sm leading-6 text-[#655d52]">
              This shows which essay points have come up. It is not a score.
            </p>

            <ol className="mt-5 divide-y divide-[#e4ddd2] border-y border-[#e4ddd2]">
              {claims.map((claim) => {
                const coverage = session.coverage.find(
                  (entry) => entry.claimId === claim.id,
                );
                const isCurrent = activeFocus?.claimId === claim.id;
                const status = coverage?.status ?? "untested";

                return (
                  <li
                    className={`py-4 ${isCurrent ? "bg-[#fff8dc] px-3 -mx-3" : ""}`}
                    key={claim.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-label={status}
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                          status === "asked"
                            ? "bg-[#e6bb28]"
                            : status === "demonstrated"
                              ? "bg-[#2e7a56]"
                              : status === "partial" || status === "needs_review"
                                ? "bg-[#bc7d35]"
                                : "bg-[#d8d3c8]"
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                          {claim.kind === "thesis" ? "Main point" : claim.id}
                          {isCurrent ? " · discussing now" : ""}
                        </p>
                        <p className="mt-1 font-serif leading-6 text-[#292824]">{claim.text}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 border-l-2 border-[#171717] bg-[#fff8dc] p-4 text-sm leading-6 text-[#554b28]">
              <span className="font-medium">{TRUST_PROMISES.pauseIsFree}</span> Take
              a moment, then resume when you are ready.
            </div>
          </aside>
        </section>

        <section className="rounded-[1.5rem] border border-[#e7e3d8] bg-[#ffffff] shadow-[0_14px_35px_rgba(70,55,30,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#eeeae2] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                Conversation record
              </p>
              <p className="mt-1 text-sm text-[#655d52]">
                Your words appear once Viva has finished transcribing them.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button
                  className="bg-[#171717] text-white hover:bg-[#303030]"
                  disabled={isConnecting || isFinishing}
                  onClick={connect}
                >
                  {isConnecting ? <LoaderCircle className="animate-spin" /> : <Mic />}
                  {isConnecting
                    ? "Connecting…"
                    : isResumingDefense
                      ? "Reconnect microphone"
                      : "Start microphone"}
                </Button>
              ) : (
                <Button onClick={togglePause} variant="outline">
                  {isPaused ? <Play /> : <Pause />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              )}
              <Button disabled={isFinishing} onClick={() => finishAndReview()} variant="outline">
                <Square /> Finish and review
              </Button>
            </div>
          </div>

          {error ? (
            <div
              className="mx-5 mt-5 flex items-start gap-3 border-l-2 border-[#c6942a] bg-[#fff5d8] p-3 text-sm leading-6 text-[#5f5018]"
              role="alert"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          {isFinalizingAnswer ? (
            <p className="mx-5 mt-5 flex items-center gap-2 text-sm text-[#655d52]" role="status">
              <LoaderCircle className="size-4 animate-spin" /> Finalizing your answer before Viva responds.
            </p>
          ) : null}

          {isAssessing ? (
            <p className="mx-5 mt-5 flex items-center gap-2 text-sm text-[#655d52]" role="status">
              <LoaderCircle className="size-4 animate-spin" /> Viva is considering the
              content of your answer.
            </p>
          ) : null}

          <div className="max-h-[28rem] overflow-y-auto p-5 sm:p-6">
            {session.transcript.turns.length === 0 ? (
              <div className="border-l-2 border-[#e6bb28] bg-[#fff8dc] px-4 py-4 text-sm leading-6 text-[#5f5018]">
                <p className="font-medium">Ready when you are</p>
                <p className="mt-1">
                  Connect the microphone to hear Viva confirm consent and ask the
                  first document-grounded question.
                </p>
              </div>
            ) : (
              <ol className="space-y-4">
                {session.transcript.turns.map((turn) => (
                  <li
                    className={`border-l-2 px-4 py-3 ${
                      turn.speaker === "student"
                        ? "border-[#171717] bg-[#fff8dc]"
                        : "border-[#e6bb28] bg-[#fff8dc]"
                    }`}
                    key={turn.id}
                  >
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                      <span>{turn.speaker === "student" ? "Student" : "Viva"}</span>
                      <span>{displayTime(turn.t)}</span>
                    </div>
                    <p className="mt-2 leading-7 text-[#292824]">{turn.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {isFinishing ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#554b28]" role="status">
            <Check className="size-4" /> Saving your conversation record.
          </p>
        ) : null}
      </div>
    </main>
  );
}
