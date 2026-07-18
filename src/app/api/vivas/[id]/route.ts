import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const updateSchema = z.object({ status: z.enum(["in_progress", "student_review", "completed"]) });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); if (!user) throw new AuthError(401, "Sign in is required.");
    const { id } = await params;
    const owner = user.role === "teacher" ? "vivas.teacher_id" : "vivas.student_id";
    const rows = await queryAssignments<{ id: string; status: string; title: string; extracted_text: string; student_name: string }>(`SELECT vivas.id, vivas.status, assignments.title, assignments.extracted_text, assignments.student_name FROM vivas JOIN assignments ON assignments.id = vivas.assignment_id WHERE vivas.id = ? AND ${owner} = ? LIMIT 1`, [id, user.id]);
    return rows[0] ? NextResponse.json({ viva: rows[0] }) : NextResponse.json({ error: "Viva not found." }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Viva." }, { status: error instanceof AuthError ? error.status : 502 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const student = await getCurrentUser(); if (!student) throw new AuthError(401, "Sign in is required."); if (student.role !== "student") throw new AuthError(403, "Only the assigned student can update this Viva.");
    const { id } = await params; const { status } = updateSchema.parse(await request.json());
    const existing = await queryAssignments<{ id: string }>("SELECT id FROM vivas WHERE id = ? AND student_id = ? LIMIT 1", [id, student.id]);
    if (!existing[0]) return NextResponse.json({ error: "Viva not found." }, { status: 404 });
    await queryAssignments("UPDATE vivas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
    return NextResponse.json({ viva: { id, status } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update Viva." }, { status: error instanceof AuthError ? error.status : 400 }); }
}
