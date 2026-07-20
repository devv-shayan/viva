import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, "Sign in is required.");
    const sql = user.role === "teacher"
      ? "SELECT assignments.id, assignments.title, assignments.student_name, assignments.file_name, assignments.mime_type, classes.name AS class_name FROM assignments JOIN classes ON classes.id = assignments.class_id WHERE classes.teacher_id = ? ORDER BY assignments.created_at DESC"
      : user.role === "student"
        ? "SELECT assignments.id, assignments.title, assignments.student_name, assignments.file_name, assignments.mime_type, classes.name AS class_name FROM assignments JOIN classes ON classes.id = assignments.class_id WHERE assignments.student_id = ? ORDER BY assignments.created_at DESC"
        : "SELECT id, title, student_name, file_name, mime_type, NULL AS class_name FROM assignments WHERE demo = 1 ORDER BY created_at DESC";
    const assignments = await queryAssignments<{ id: string; title: string; student_name: string; file_name: string; mime_type: string; class_name: string | null }>(sql, user.role === "judge" ? [] : [user.id]);
    return NextResponse.json({ assignments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load assignments." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}