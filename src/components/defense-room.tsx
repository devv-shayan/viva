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
import {
  getDefenseElapsedMs,
  isDefenseTimeExpired,
  pauseDefenseClock,
  resumeDefenseClock,
  type DefenseClock,
} from "@/lib/defense-clock";
import { vivaModels } from "@/lib/models";
import {
  consumePauseFocusRecovery,
  createPauseRecoveryState,
  markAgentResponseRequested,
  markPauseInterruptRequested,
  recordRealtimeResponseDone,
} from "@/lib/pause-recovery";
import {
  getRealtimeResponseDiagnostic,
  type RealtimeResponse,
} from "@/lib/realtime-session";
import {
  createFocusForClaim,
  createPreviewNextFocus,
  formatFocus,
  shouldResumeDefense,
  type Focus,
  type RealtimeResponseDiagnostic,
  type TranscriptTurn,
  type VivaSessionState,
} from "@/lib/session-state";

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
  onAppendRealtimeDiagnostic: (
    diagnostic: RealtimeResponseDiagnostic,
  ) => VivaSessionState | null;
  onAppendTurn: (turn: TranscriptTurn) => VivaSessionState | null;
  onComplete: () => VivaSessionState | null;
  onSetPendingFocus: (focus: Focus | undefined) => VivaSessionState | null;
  session: VivaSessionState;
};

const FINAL_AUDIO_DRAIN_TIMEOUT_MS = 8_000;
const FINAL_AUDIO_PLAYOUT_GRACE_MS = 350;
const RESUME_FOCUS_INSTRUCTION =
  "[RESUME] This is a reconnection of a consented defense. Consent has already been spoken. Do not repeat consent, greet the student, or add a preamble. Ask exactly one concise question for this FOCUS. Quote at most twelve words; paraphrase anything longer.";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function createTurnId(speaker: TranscriptTurn["speaker"]) {
  return `${speaker}-${crypto.randomUUID()}`;
}

function displayTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, ...session.transcript.turns.map((turn) => turn.t)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [shouldReaskFocusAfterPause, setShouldReaskFocusAfterPause] =
    useState(false);

  useEffect(() => {
    sessionStateRef.current = session;
  }, [session]);

  const timestamp = useCallback(() => {
    return getDefenseElapsedMs(defenseClockRef.current, performance.now());
  }, []);

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
    [clearFinalAudioTimers, onComplete],
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
      const activated = onActivateFocus();

      if (!activated) {
        setError("The consented defense session is no longer available.");
        return;
      }

      sessionStateRef.current = activated;

      const request = focusSequenceRef.current
        .catch(() => undefined)
        .then(() => {
          if (endRequestedRef.current) {
            return;
          }

          const realtime = realtimeRef.current;

          if (!realtime) {
            return;
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

          // This is serialized behind the system item. The SDK transport can defer
          // the response until a prior response has fully finished.
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
      const afterAnswer = onAppendTurn({
        id: itemId,
        speaker: "student",
        t: timestamp(),
        text,
      });

      if (!afterAnswer) {
        return;
      }

      sessionStateRef.current = afterAnswer;

      // Block 4 will replace this deterministic preview path with /api/assess.
      // The focus and transcript seams stay identical, so the assessment call
      // cannot race the next model response.
      const nextFocus = createPreviewNextFocus(afterAnswer) ?? focusForWrap(afterAnswer);

      if (!nextFocus) {
        finishAndReview();
        return;
      }

      const withPendingFocus = onSetPendingFocus(nextFocus);

      if (!withPendingFocus) {
        return;
      }

      sessionStateRef.current = withPendingFocus;
      requestReplyForFocus(nextFocus);
    },
    [finishAndReview, onAppendTurn, onSetPendingFocus, requestReplyForFocus, timestamp],
  );

  const handleAgentTranscript = useCallback(
    (itemId: string, transcript: string) => {
      const text = transcript.trim();

      if (!text || agentItemIdsRef.current.has(itemId)) {
        return;
      }

      agentItemIdsRef.current.add(itemId);
      const afterQuestion = onAppendTurn({
        id: itemId,
        speaker: "agent",
        t: timestamp(),
        text,
      });

      if (afterQuestion) {
        sessionStateRef.current = afterQuestion;
      }
    },
    [onAppendTurn, timestamp],
  );

  const connect = useCallback(async () => {
    const connectionAttempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = connectionAttempt;

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

        if (raw.type === "response.done") {
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
          handleStudentTranscript(
            raw.item_id ?? createTurnId("student"),
            raw.transcript ?? "",
          );
          return;
        }

        if (raw.type === "response.output_audio_transcript.done") {
          handleAgentTranscript(
            raw.item_id ?? createTurnId("agent"),
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

    const shouldPause = !isPaused;
    const nowMs = performance.now();

    if (shouldPause) {
      defenseClockRef.current = pauseDefenseClock(
        defenseClockRef.current,
        nowMs,
      );
      pauseRecoveryRef.current = markPauseInterruptRequested(
        pauseRecoveryRef.current,
      );
      setShouldReaskFocusAfterPause(false);
      realtime.interrupt();
    } else {
      defenseClockRef.current = resumeDefenseClock(
        defenseClockRef.current,
        nowMs,
      );
      setElapsedMs(getDefenseElapsedMs(defenseClockRef.current, nowMs));
    }

    realtime.mute(shouldPause);
    setIsPaused(shouldPause);
  }, [connectionStatus, isPaused]);

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
      clearFinalAudioTimers();
      realtimeRef.current?.close();
      realtimeRef.current = null;
    };
  }, [clearFinalAudioTimers]);

  const activeFocus = session.activeFocus ?? session.pendingFocus;
  const highlights = activeFocus
    ? [{ ...activeFocus.passage, label: "Viva's current focus" }]
    : [];
  const claims = [session.graph.thesis, ...session.graph.claims];
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const isResumingDefense = shouldResumeDefense(session);

  return (
    <main className="min-h-screen bg-[#f6f3ed] px-4 py-5 text-[#25231f] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[96rem]">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c2] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#746a5b] uppercase">
              Viva / live defense
            </p>
            <h1 className="mt-2 font-serif text-3xl tracking-[-0.02em] sm:text-4xl">
              {session.submission.title}
            </h1>
            <p className="mt-2 text-sm text-[#655d52]">
              {session.submission.studentName} · Questions stay inside the highlighted passage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 border border-[#d4cbbb] bg-[#fcfaf6] px-3 py-2 text-sm text-[#554e43]">
              <Clock3 className="size-4 text-[#746a5b]" /> {displayTime(elapsedMs)} / 5:00
            </span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium ${
                isConnected
                  ? "bg-[#dcebe2] text-[#23513d]"
                  : connectionStatus === "error"
                    ? "bg-[#fff0cd] text-[#765611]"
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
          </div>
        </header>

        <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
          <article className="border border-[#d8d0c2] bg-[#fcfaf6] p-5 shadow-[0_14px_35px_rgba(70,55,30,0.05)] sm:p-7">
            <div className="flex flex-col gap-3 border-b border-[#e0d9ce] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                  <FileText className="size-3.5" /> Submission
                </div>
                <p className="mt-2 font-serif text-xl leading-7 text-[#413d35]">
                  {activeFocus
                    ? "The amber passage is the only place Viva is exploring right now."
                    : "Viva will highlight the passage it is discussing."}
                </p>
              </div>
              {activeFocus ? (
                <span className="w-fit bg-[#f3e2aa] px-3 py-2 text-xs font-semibold tracking-[0.1em] text-[#654d14] uppercase">
                  {activeFocus.move.replace("_", " ")}
                </span>
              ) : null}
            </div>

            <PassageDocument
              className="mt-6 space-y-6"
              highlights={highlights}
              submission={session.submission}
            />
          </article>

          <aside className="border border-[#d8d0c2] bg-[#fcfaf6] p-5 xl:sticky xl:top-5 xl:h-fit">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
              Understanding map
            </p>
            <p className="mt-2 text-sm leading-6 text-[#655d52]">
              Viva marks what it has asked about. It does not score your answers here.
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
                    className={`py-4 ${isCurrent ? "bg-[#fff7df] px-3 -mx-3" : ""}`}
                    key={claim.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-label={status}
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                          status === "asked"
                            ? "bg-[#d2a93e]"
                            : status === "demonstrated"
                              ? "bg-[#2e7a56]"
                              : status === "partial" || status === "needs_review"
                                ? "bg-[#bc7d35]"
                                : "bg-[#c8c0b3]"
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                          {claim.kind === "thesis" ? "Central thesis" : claim.id}
                          {isCurrent ? " · now" : ""}
                        </p>
                        <p className="mt-1 font-serif leading-6 text-[#39342c]">{claim.text}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 border-l-2 border-[#1e463e] bg-[#edf5ee] p-4 text-sm leading-6 text-[#365945]">
              <span className="font-medium">You can pause at any time.</span> Take
              a moment, then resume when you are ready.
            </div>
          </aside>
        </section>

        <section className="border border-[#d8d0c2] bg-[#fcfaf6] shadow-[0_14px_35px_rgba(70,55,30,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#e0d9ce] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#746a5b] uppercase">
                Live transcript
              </p>
              <p className="mt-1 text-sm text-[#655d52]">
                Entries appear only after their transcription is final.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button
                  className="bg-[#1e463e] text-white hover:bg-[#173830]"
                  disabled={isConnecting || isFinishing}
                  onClick={connect}
                >
                  {isConnecting ? <LoaderCircle className="animate-spin" /> : <Mic />}
                  {isConnecting
                    ? "Connecting…"
                    : isResumingDefense
                      ? "Reconnect microphone"
                      : "Connect microphone"}
                </Button>
              ) : (
                <Button onClick={togglePause} variant="outline">
                  {isPaused ? <Play /> : <Pause />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              )}
              <Button disabled={isFinishing} onClick={() => finishAndReview()} variant="outline">
                <Square /> End & review
              </Button>
            </div>
          </div>

          {error ? (
            <div
              className="mx-5 mt-5 flex items-start gap-3 border-l-2 border-[#c6942a] bg-[#fff5d8] p-3 text-sm leading-6 text-[#644c16]"
              role="alert"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <div className="max-h-[28rem] overflow-y-auto p-5 sm:p-6">
            {session.transcript.turns.length === 0 ? (
              <div className="border-l-2 border-[#d2a93e] bg-[#fff7df] px-4 py-4 text-sm leading-6 text-[#644c16]">
                <p className="font-medium">Ready when you are.</p>
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
                        ? "border-[#1e463e] bg-[#edf5ee]"
                        : "border-[#d2a93e] bg-[#fff7df]"
                    }`}
                    key={turn.id}
                  >
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.12em] text-[#766d60] uppercase">
                      <span>{turn.speaker === "student" ? "Student" : "Viva"}</span>
                      <span>{displayTime(turn.t)}</span>
                    </div>
                    <p className="mt-2 leading-7 text-[#39342c]">{turn.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {isFinishing ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#365945]" role="status">
            <Check className="size-4" /> Viva is finishing the conversation and saving the final transcript.
          </p>
        ) : null}
      </div>
    </main>
  );
}
