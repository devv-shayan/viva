import { NextResponse } from "next/server";

import {
  AnalysisGenerationError,
  AnalysisValidationError,
  analyzeSubmission,
} from "@/lib/analyze";
import { AnalyzeRequestSchema, createSubmission } from "@/lib/analysis-types";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Send the submission as valid JSON.", 400);
  }

  const parsedRequest = AnalyzeRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return errorResponse(
      "Check the student name, essay, and rubric objectives before analyzing.",
      400,
    );
  }

  const submission = createSubmission(parsedRequest.data);

  try {
    const graph = await analyzeSubmission(submission, parsedRequest.data.rubric);

    return NextResponse.json({ submission, graph });
  } catch (error) {
    if (error instanceof AnalysisValidationError) {
      console.error("Viva analysis failed evidence-anchor validation", {
        issueCount: error.issues.length,
      });

      return errorResponse(
        "Viva could not anchor every finding to the submitted text. Please try again.",
        422,
      );
    }

    if (error instanceof AnalysisGenerationError) {
      console.error("Viva analysis did not yield a usable structured response", {
        name: error.name,
      });

      return errorResponse(
        "Viva could not create a usable analysis this time. Please try again.",
        502,
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Viva analysis request failed", { message });

    if (message.startsWith("OPENAI_API_KEY")) {
      return errorResponse(message, 500);
    }

    return errorResponse(
      "Viva could not analyze the submission right now. Please try again.",
      502,
    );
  }
}
