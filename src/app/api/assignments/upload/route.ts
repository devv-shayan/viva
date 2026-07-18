import { NextResponse } from "next/server";

import { extractAssignmentText } from "@/lib/assignment-text";
import { assignmentUploadRequirements } from "@/lib/assignment-source";
import { createAssignmentKey, queryAssignments, storeAssignmentFile } from "@/lib/cloudflare-assignments";
import { AuthError, requireRole } from "@/lib/auth";

export const runtime = "nodejs";

const mimeTypes = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
} as const;

export async function POST(request: Request) {
  try {
    const student = await requireRole("student");
    const form = await request.formData();
    const file = form.get("file");
    const studentName = student.name;
    const title = String(form.get("title") || "").trim();
    const classId = String(form.get("classId") || "").trim();
    const memberships = await queryAssignments<{ id: string }>("SELECT class_id AS id FROM enrollments WHERE class_id = ? AND student_id = ? LIMIT 1", [classId, student.id]);
    if (!memberships[0]) return NextResponse.json({ error: "Choose one of your enrolled classes." }, { status: 403 });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a PDF or DOCX assignment." }, { status: 400 });
    }

    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] as keyof typeof mimeTypes | undefined;
    const mimeType = extension ? mimeTypes[extension] : undefined;
    if (!mimeType || file.size === 0 || file.size > assignmentUploadRequirements.maxBytes) {
      return NextResponse.json({ error: "Use a PDF or DOCX assignment up to 10 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extractedText = (await extractAssignmentText({ bytes, mimeType })).trim();
    if (!extractedText) {
      return NextResponse.json({ error: "We could not find readable text in this file." }, { status: 422 });
    }

    const id = crypto.randomUUID();
    const key = createAssignmentKey(file.name, id);
    await storeAssignmentFile({ body: bytes, contentType: mimeType, key });
    await queryAssignments(
      "INSERT INTO assignments (id, title, student_name, file_name, mime_type, r2_key, extracted_text, demo, class_id, student_id) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
      [id, title || file.name.replace(/\.[^.]+$/, ""), studentName, file.name, mimeType, key, extractedText, classId, student.id],
    );

    return NextResponse.json({
      assignment: { id, title: title || file.name.replace(/\.[^.]+$/, ""), student_name: studentName, extracted_text: extractedText },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload the assignment." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}
