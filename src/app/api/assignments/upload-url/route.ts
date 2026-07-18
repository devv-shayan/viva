import { NextResponse } from "next/server";
import { createAssignmentUpload } from "@/lib/cloudflare-assignments";
import { assignmentUploadRequirements } from "@/lib/assignment-source";

export async function POST(request: Request) {
  const input = await request.json() as { fileName?: string; contentType?: string; size?: number };
  const extension = input.fileName?.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!input.fileName || !input.contentType || !extension || !assignmentUploadRequirements.acceptedExtensions.includes(extension as ".pdf" | ".docx") || !assignmentUploadRequirements.acceptedTypes.includes(input.contentType as never) || !input.size || input.size > assignmentUploadRequirements.maxBytes) {
    return NextResponse.json({ error: "Use a PDF or DOCX assignment up to 10 MB." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createAssignmentUpload({ fileName: input.fileName, contentType: input.contentType }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare upload." }, { status: 502 });
  }
}
