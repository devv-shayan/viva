import { NextResponse } from "next/server";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rows = await queryAssignments<{ name: string; teacher_name: string }>("SELECT classes.name, users.name AS teacher_name FROM classes JOIN users ON users.id = classes.teacher_id WHERE classes.join_code = ? LIMIT 1", [code.toUpperCase()]);
  return rows[0] ? NextResponse.json({ classroom: rows[0] }) : NextResponse.json({ error: "Invite not found." }, { status: 404 });
}
