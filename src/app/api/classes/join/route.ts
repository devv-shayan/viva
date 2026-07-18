import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const schema = z.object({ code: z.string().trim().length(8).transform((code) => code.toUpperCase()) });

export async function POST(request: Request) {
  try {
    const student = await requireRole("student");
    const { code } = schema.parse(await request.json());
    const classrooms = await queryAssignments<{ id: string; name: string }>("SELECT id, name FROM classes WHERE join_code = ? LIMIT 1", [code]);
    const classroom = classrooms[0];
    if (!classroom) return NextResponse.json({ error: "That class code was not found." }, { status: 404 });
    await queryAssignments("INSERT OR IGNORE INTO enrollments (class_id, student_id) VALUES (?, ?)", [classroom.id, student.id]);
    return NextResponse.json({ classroom });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not join class." }, { status: error instanceof AuthError ? error.status : 400 });
  }
}
