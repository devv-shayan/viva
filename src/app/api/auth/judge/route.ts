import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export async function POST() {
  try {
    const id = crypto.randomUUID();
    const suffix = id.slice(0, 8);
    const email = `judge-${suffix}@demo.viva.local`;
    await queryAssignments(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'judge')",
      [id, `Judge demo ${suffix}`, email, await hashPassword(crypto.randomUUID())],
    );
    await createSession(id);
    return NextResponse.json({ user: { id, name: `Judge demo ${suffix}`, role: "judge" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not start the judge demo." }, { status: 502 });
  }
}
