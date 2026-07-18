import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, "Sign in is required.");
    const { id } = await params;
    const sql = user.role === "teacher"
      ? "SELECT assignments.id, assignments.title, assignments.student_name, assignments.extracted_text FROM assignments JOIN classes ON classes.id = assignments.class_id WHERE assignments.id = ? AND classes.teacher_id = ? LIMIT 1"
      : user.role === "student"
        ? "SELECT id, title, student_name, extracted_text FROM assignments WHERE id = ? AND student_id = ? LIMIT 1"
        : "SELECT id, title, student_name, extracted_text FROM assignments WHERE id = ? AND demo = 1 LIMIT 1";
    const assignment = (await queryAssignments<{ id: string; title: string; student_name: string; extracted_text: string }>(sql, user.role === "judge" ? [id] : [id, user.id]))[0];
    return assignment ? NextResponse.json({ assignment }) : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load assignment." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}