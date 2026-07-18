import { NextResponse } from "next/server";

import { AuthError, requireRole } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";
import { VivaSessionSchema } from "@/lib/session-state";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole("teacher");
    const { id } = await params;
    const rows = await queryAssignments<{ session_state: string | null }>(
      "SELECT session_state FROM vivas WHERE id = ? AND teacher_id = ? LIMIT 1",
      [id, teacher.id],
    );
    const serialized = rows[0]?.session_state;
    if (!serialized) return NextResponse.json({ error: "Generate the evidence report before sharing it." }, { status: 409 });
    const session = VivaSessionSchema.parse(JSON.parse(serialized));
    if (!session.dossier) return NextResponse.json({ error: "Generate the evidence report before sharing it." }, { status: 409 });
    await queryAssignments("UPDATE vivas SET report_shared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    return NextResponse.json({ sharedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not share the report." }, { status: error instanceof AuthError ? error.status : 400 });
  }
}