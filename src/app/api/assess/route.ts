import { NextResponse } from "next/server";

import {
  AssessGenerationError,
  AssessValidationError,
  assessAnswer,
} from "@/lib/assess";
import { AssessRequestSchema } from "@/lib/assess-types";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Send the completed answer as valid JSON.", 400);
  }

  const parsedRequest = AssessRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return errorResponse(
      "Viva could not safely assess that answer. The defense can continue.",
      400,
    );
  }

  try {
    return NextResponse.json(await assessAnswer(parsedRequest.data));
  } catch (error) {
    if (error instanceof AssessValidationError) {
      console.error("Viva assessment failed fairness validation", {
        issueCount: error.issues.length,
      });

      return errorResponse(
        "Viva could not safely assess that answer. The defense can continue.",
        422,
      );
    }

    if (error instanceof AssessGenerationError) {
      console.error("Viva assessment did not yield a usable structured result", {
        name: error.name,
      });

      return errorResponse(
        "Viva could not process that answer. The defense can continue.",
        502,
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Viva assessment request failed", { message });

    if (message.startsWith("OPENAI_API_KEY")) {
      return errorResponse(message, 500);
    }

    return errorResponse(
      "Viva could not process that answer. The defense can continue.",
      502,
    );
  }
}
