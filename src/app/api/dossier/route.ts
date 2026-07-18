import { NextResponse } from "next/server";

import {
  DossierGenerationError,
  DossierValidationError,
  createDossier,
} from "@/lib/dossier";
import { DossierRequestSchema } from "@/lib/dossier-types";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Send the consented defense record as valid JSON.", 400);
  }

  const parsedRequest = DossierRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return errorResponse(
      "Viva could not safely prepare that evidence record. The teacher can still review the transcript.",
      400,
    );
  }

  try {
    return NextResponse.json(await createDossier(parsedRequest.data));
  } catch (error) {
    if (error instanceof DossierValidationError) {
      console.error("Viva dossier failed citation validation", {
        issueCount: error.issues.length,
      });

      return errorResponse(
        "Viva could not create a citation-safe dossier. The teacher can still review the transcript.",
        422,
      );
    }

    if (error instanceof DossierGenerationError) {
      console.error("Viva dossier did not yield a usable structured result", {
        name: error.name,
      });

      return errorResponse(
        "Viva could not prepare the dossier right now. The teacher can still review the transcript.",
        502,
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Viva dossier request failed", { message });

    return errorResponse(
      "Viva could not prepare the dossier right now. The teacher can still review the transcript.",
      502,
    );
  }
}
