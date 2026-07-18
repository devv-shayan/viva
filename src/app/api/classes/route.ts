import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const createSchema = z.object({ name: z.string().trim().min(2).max(100) });

function joinCode() { return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(); }

export async function GET() {
  try {
    const teacher = await requireRole("teacher");
    const classes = await queryAssignments<{ id: string; name: string; join_code: string; student_count: number }>(
      "SELECT classes.id, classes.name, classes.join_code, COUNT(enrollments.student_id) AS student_count FROM classes LEFT JOIN enrollments ON enrollments.class_id = classes.id WHERE classes.teacher_id = ? GROUP BY classes.id ORDER BY classes.created_at DESC",
      [teacher.id],
    );
    return NextResponse.json({ classes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load classes." }, { status: error instanceof AuthError ? error.status : 502 });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireRole("teacher");
    const input = createSchema.parse(await request.json());
    const classroom = { id: crypto.randomUUID(), name: input.name, joinCode: joinCode() };
    await queryAssignments("INSERT INTO classes (id, teacher_id, name, join_code) VALUES (?, ?, ?, ?)", [classroom.id, teacher.id, classroom.name, classroom.joinCode]);
    return NextResponse.json({ classroom }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create class." }, { status: error instanceof AuthError ? error.status : 400 });
  }
}
