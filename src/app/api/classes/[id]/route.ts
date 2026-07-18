import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole("teacher");
    const { id } = await params;
    const classrooms = await queryAssignments<{ id: string; name: string; join_code: string }>("SELECT id, name, join_code FROM classes WHERE id = ? AND teacher_id = ? LIMIT 1", [id, teacher.id]);
    const classroom = classrooms[0];
    if (!classroom) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    const students = await queryAssignments<{ id: string; name: string; email: string; assignment_count: number; open_viva_count: number; completed_viva_id: string | null }>(
      "SELECT users.id, users.name, users.email, COUNT(DISTINCT assignments.id) AS assignment_count, COUNT(DISTINCT CASE WHEN vivas.status IN ('sent','in_progress','student_review','follow_up') THEN vivas.id END) AS open_viva_count, MAX(CASE WHEN vivas.status = 'completed' THEN vivas.id END) AS completed_viva_id FROM enrollments JOIN users ON users.id = enrollments.student_id LEFT JOIN assignments ON assignments.student_id = users.id AND assignments.class_id = enrollments.class_id LEFT JOIN vivas ON vivas.student_id = users.id AND vivas.class_id = enrollments.class_id WHERE enrollments.class_id = ? GROUP BY users.id ORDER BY users.name",
      [id],
    );
    return NextResponse.json({ classroom, students });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load class." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}
