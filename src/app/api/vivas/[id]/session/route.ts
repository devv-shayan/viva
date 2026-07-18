import { NextResponse } from "next/server";

import { analyzeSubmission } from "@/lib/analyze";
import { createSubmission, type RubricObjective } from "@/lib/analysis-types";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";
import { createDefenseSession, VivaSessionSchema } from "@/lib/session-state";

const liveRubric: RubricObjective[] = [
  { id: "r1", text: "Explains the main claim using evidence from the assignment" },
  { id: "r2", text: "Explains the reasoning, assumptions, and trade-offs" },
  { id: "r3", text: "Responds thoughtfully to alternative perspectives" },
];

type VivaRow = {
  session_state: string | null;
  title: string;
  extracted_text: string;
  student_name: string;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, "Sign in is required.");

    const { id } = await params;
    const ownerColumn = user.role === "teacher" ? "vivas.teacher_id" : "vivas.student_id";
    const rows = await queryAssignments<VivaRow>(
      `SELECT vivas.session_state, assignments.title, assignments.extracted_text, assignments.student_name FROM vivas JOIN assignments ON assignments.id = vivas.assignment_id WHERE vivas.id = ? AND ${ownerColumn} = ? LIMIT 1`,
      [id, user.id],
    );
    const viva = rows[0];
    if (!viva) return NextResponse.json({ error: "Viva not found." }, { status: 404 });

    if (viva.session_state) {
      return NextResponse.json({ session: VivaSessionSchema.parse(JSON.parse(viva.session_state)) });
    }

    if (user.role !== "student") {
      return NextResponse.json({ session: null });
    }

    const text = viva.extracted_text.trim();
    if (text.length < 80) {
      return NextResponse.json({ error: "This assignment does not have enough readable text to start a Viva." }, { status: 422 });
    }

    const submission = createSubmission({
      studentName: viva.student_name,
      title: viva.title,
      text,
      rubric: liveRubric,
    });
    const graph = await analyzeSubmission(submission, liveRubric);
    const session = createDefenseSession({ graph, rubric: liveRubric, submission });

    await queryAssignments(
      "UPDATE vivas SET session_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND session_state IS NULL",
      [JSON.stringify(session), id],
    );

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare this Viva." },
      { status: error instanceof AuthError ? error.status : 502 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); if (!user) throw new AuthError(401, "Sign in is required.");
    const { id } = await params; const session = VivaSessionSchema.parse((await request.json() as { session: unknown }).session);
    const column = user.role === "teacher" ? "teacher_id" : "student_id";
    const exists = await queryAssignments<{ id: string }>(`SELECT id FROM vivas WHERE id = ? AND ${column} = ? LIMIT 1`, [id, user.id]);
    if (!exists[0]) return NextResponse.json({ error: "Viva not found." }, { status: 404 });
    await queryAssignments("UPDATE vivas SET session_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [JSON.stringify(session), id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Viva session." }, { status: error instanceof AuthError ? error.status : 400 }); }
}