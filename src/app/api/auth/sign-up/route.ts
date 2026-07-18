import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const schema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(12).max(128), role: z.enum(["teacher", "student"]), inviteCode: z.string().length(8).optional() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const id = crypto.randomUUID();
    await queryAssignments("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", [id, input.name, input.email.toLowerCase(), await hashPassword(input.password), input.role]);
    if (input.role === "student" && input.inviteCode) {
      const classrooms = await queryAssignments<{ id: string }>("SELECT id FROM classes WHERE join_code = ? LIMIT 1", [input.inviteCode.toUpperCase()]);
      if (!classrooms[0]) throw new Error("This class invite is no longer available.");
      await queryAssignments("INSERT INTO enrollments (class_id, student_id) VALUES (?, ?)", [classrooms[0].id, id]);
    }
    await createSession(id);
    return NextResponse.json({ user: { id, name: input.name, role: input.role } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create your account." }, { status: 400 });
  }
}
