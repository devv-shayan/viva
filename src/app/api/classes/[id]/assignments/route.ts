import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole("teacher"); const { id } = await params;
    const assignments = await queryAssignments<{ id: string; title: string; student_id: string; student_name: string; file_name: string; created_at: string }>(
      "SELECT assignments.id, assignments.title, assignments.student_id, users.name AS student_name, assignments.file_name, assignments.created_at FROM assignments JOIN classes ON classes.id = assignments.class_id JOIN users ON users.id = assignments.student_id WHERE assignments.class_id = ? AND classes.teacher_id = ? ORDER BY assignments.created_at DESC",
      [id, teacher.id],
    );
    return NextResponse.json({ assignments });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load assignments." }, { status: error instanceof AuthError ? error.status : 502 }); }
}
