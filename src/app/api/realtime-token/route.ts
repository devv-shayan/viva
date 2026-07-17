import { NextResponse } from "next/server";

import { requireOpenAIKey } from "@/lib/env";
import { vivaModels } from "@/lib/models";

export const runtime = "nodejs";

type RealtimeClientSecretResponse = {
  error?: { message?: string };
  expires_at?: number;
  value?: string;
};

/**
 * Creates a short-lived browser credential for the Realtime WebRTC connection.
 * The long-lived project API key remains on the server.
 */
export async function POST() {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireOpenAIKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            model: vivaModels.realtime,
            type: "realtime",
          },
        }),
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as RealtimeClientSecretResponse;

    if (!response.ok) {
      console.error("Realtime client-secret request failed", {
        message: payload.error?.message,
        status: response.status,
      });

      return NextResponse.json(
        { error: "OpenAI could not create a Realtime client secret." },
        { status: response.status },
      );
    }

    if (typeof payload.value !== "string" || !payload.value.startsWith("ek_")) {
      console.error("Realtime client-secret response did not contain an ek_ secret.");

      return NextResponse.json(
        { error: "OpenAI returned an invalid Realtime client secret." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      clientSecret: payload.value,
      expiresAt: payload.expires_at,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create a Realtime client secret.";

    console.error("Realtime client-secret route failed", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
