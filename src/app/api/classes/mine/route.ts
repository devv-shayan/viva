import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET() {
  try {
    const student = await requireRole("student");
    const classes = await queryAssignments<{ id: string; name: string; teacher_name: string }>(
      "SELECT classes.id, classes.name, users.name AS teacher_name FROM enrollments JOIN classes ON classes.id = enrollments.class_id JOIN users ON users.id = classes.teacher_id WHERE enrollments.student_id = ? ORDER BY classes.created_at DESC",
      [student.id],
    );
    return NextResponse.json({ classes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load classes." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}
