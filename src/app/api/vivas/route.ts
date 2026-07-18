import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getCurrentUser, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const sendSchema = z.object({ assignmentId: z.string().uuid(), classId: z.string().uuid(), studentId: z.string().uuid(), dueAt: z.string().datetime().optional() });

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, "Sign in is required.");
    const ownerColumn = user.role === "teacher" ? "vivas.teacher_id" : "vivas.student_id";
    const vivas = await queryAssignments<{ id: string; status: string; due_at: string | null; title: string; student_name: string; updated_at: string }>(
      `SELECT vivas.id, vivas.status, vivas.due_at, vivas.updated_at, vivas.report_shared_at, assignments.title, assignments.student_name FROM vivas JOIN assignments ON assignments.id = vivas.assignment_id WHERE ${ownerColumn} = ? ORDER BY vivas.updated_at DESC`,
      [user.id],
    );
    return NextResponse.json({ vivas });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Vivas." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireRole("teacher");
    const input = sendSchema.parse(await request.json());
    const permitted = await queryAssignments<{ ok: number }>(
      "SELECT 1 AS ok FROM classes JOIN enrollments ON enrollments.class_id = classes.id JOIN assignments ON assignments.id = ? WHERE classes.id = ? AND classes.teacher_id = ? AND enrollments.student_id = ? AND assignments.student_id = ? AND assignments.class_id = ? LIMIT 1",
      [input.assignmentId, input.classId, teacher.id, input.studentId, input.studentId, input.classId],
    );
    if (!permitted[0]) return NextResponse.json({ error: "This student and assignment are not in your class." }, { status: 403 });
    const id = crypto.randomUUID();
    await queryAssignments("INSERT INTO vivas (id, class_id, assignment_id, teacher_id, student_id, due_at) VALUES (?, ?, ?, ?, ?, ?)", [id, input.classId, input.assignmentId, teacher.id, input.studentId, input.dueAt ?? null]);
    return NextResponse.json({ viva: { id, status: "sent" } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send Viva." }, { status: error instanceof AuthError ? error.status : 400 });
  }
}
