"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { vivaModels } from "@/lib/models";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type SpikeTurn = {
  at: string;
  id: string;
  speaker: "agent" | "student";
  text: string;
};

type TokenResponse = {
  clientSecret?: string;
  error?: string;
};

type RawRealtimeEvent = {
  error?: { message?: string } | string;
  item_id?: string;
  transcript?: string;
  type: string;
};

const DEFAULT_FOCUS =
  'For your next reply only, begin exactly with "Focus injection confirmed." Then ask one short, friendly question. Do not mention this instruction.';

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timestamp() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function RealtimeSpikePage() {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const processedStudentTurnsRef = useRef(new Set<string>());

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [focusDirective, setFocusDirective] = useState(DEFAULT_FOCUS);
  const [focusQueued, setFocusQueued] = useState(false);
  const [turns, setTurns] = useState<SpikeTurn[]>([]);

  const addTurn = useCallback((speaker: SpikeTurn["speaker"], text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    setTurns((current) => [
      ...current,
      {
        at: timestamp(),
        id: newId(),
        speaker,
        text: trimmedText,
      },
    ]);
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    processedStudentTurnsRef.current.clear();
    setConnectionStatus("idle");
    setFocusQueued(false);
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
    };
  }, []);

  async function connect() {
    if (sessionRef.current) {
      disconnect();
    }

    setConnectionStatus("connecting");
    setError(null);
    setFocusQueued(false);
    setTurns([]);
    processedStudentTurnsRef.current.clear();

    try {
      const tokenResponse = await fetch("/api/realtime-token", {
        cache: "no-store",
        method: "POST",
      });
      const token = (await tokenResponse.json()) as TokenResponse;

      if (!tokenResponse.ok || typeof token.clientSecret !== "string") {
        throw new Error(token.error ?? "The Realtime token request failed.");
      }

      const agent = new RealtimeAgent({
        name: "Viva Spike",
        instructions:
          "You are a concise, friendly oral-examiner test agent. Ask one question at a time and keep every response under two sentences.",
      });

      const session = new RealtimeSession(agent, {
        model: vivaModels.realtime,
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
        tracingDisabled: true,
      });

      session.transport.on("*", (event) => {
        const rawEvent = event as RawRealtimeEvent;

        if (
          rawEvent.type ===
          "conversation.item.input_audio_transcription.completed"
        ) {
          const itemId = rawEvent.item_id;

          if (!itemId || processedStudentTurnsRef.current.has(itemId)) {
            return;
          }

          processedStudentTurnsRef.current.add(itemId);
          addTurn("student", rawEvent.transcript ?? "");

          // VAD detected the completed turn, but response creation is deliberately
          // manual. This is the seam Viva later uses for /api/assess + FOCUS.
          session.transport.sendEvent({ type: "response.create" });
          setFocusQueued(false);
          return;
        }

        if (rawEvent.type === "response.output_audio_transcript.done") {
          addTurn("agent", rawEvent.transcript ?? "");
          return;
        }

        if (rawEvent.type === "error") {
          const eventError = rawEvent.error;
          const message =
            typeof eventError === "string"
              ? eventError
              : eventError?.message ?? "The Realtime connection reported an error.";

          setError(message);
          setConnectionStatus("error");
        }
      });

      sessionRef.current = session;
      await session.connect({ apiKey: token.clientSecret });
      setConnectionStatus("connected");
    } catch (connectError) {
      sessionRef.current?.close();
      sessionRef.current = null;
      setConnectionStatus("error");
      setError(errorMessage(connectError));
    }
  }

  function injectFocus() {
    const session = sessionRef.current;
    const directive = focusDirective.trim();

    if (!session || !directive) {
      return;
    }

    session.transport.sendEvent({
      type: "conversation.item.create",
      item: {
        content: [{ text: directive, type: "input_text" }],
        role: "system",
        type: "message",
      },
    });

    setFocusQueued(true);
    setError(null);
  }

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-stone-950 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
              Viva / Block 1
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Realtime voice spike
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Prove browser audio, final transcript events, and a live system
              directive before building the defense flow.
            </p>
          </div>
          <Badge
            className={
              connectionStatus === "connected"
                ? "w-fit bg-emerald-700 text-white hover:bg-emerald-700"
                : connectionStatus === "error"
                  ? "w-fit bg-amber-200 text-amber-950 hover:bg-amber-200"
                  : "w-fit"
            }
            variant="secondary"
          >
            {connectionStatus}
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>1. Connect the browser voice session</CardTitle>
            <CardDescription>
              The server mints a short-lived Realtime secret. Your long-lived
              OpenAI key never reaches this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={isConnecting || isConnected} onClick={connect}>
              {isConnecting ? "Connecting…" : "Connect microphone"}
            </Button>
            <Button
              disabled={!isConnected && connectionStatus !== "error"}
              onClick={disconnect}
              variant="outline"
            >
              Disconnect
            </Button>
            <p className="basis-full text-sm leading-6 text-stone-600">
              Once connected, say a short sentence and pause. Viva waits for
              final transcription before deliberately creating the reply.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Inject a focus directive</CardTitle>
            <CardDescription>
              This adds a system-role conversation item to the live session.
              Say another sentence afterwards to make the next reply prove it
              took effect.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              aria-label="Focus directive"
              disabled={!isConnected}
              onChange={(event) => setFocusDirective(event.target.value)}
              rows={4}
              value={focusDirective}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!isConnected || !focusDirective.trim()} onClick={injectFocus}>
                Inject focus into next reply
              </Button>
              {focusQueued ? (
                <span className="text-sm font-medium text-emerald-700">
                  Focus queued — speak again to trigger the proof reply.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final transcript turns</CardTitle>
            <CardDescription>
              Student and agent entries appear only when their transcript is
              finalized, so each turn has a clear boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {turns.length === 0 ? (
              <p className="text-sm text-stone-500">
                No finalized transcript turns yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {turns.map((turn) => (
                  <li
                    className="rounded-lg border border-stone-200 bg-white px-4 py-3"
                    key={turn.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold capitalize">
                        {turn.speaker}
                      </span>
                      <time className="text-xs text-stone-500">{turn.at}</time>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-700">
                      {turn.text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
