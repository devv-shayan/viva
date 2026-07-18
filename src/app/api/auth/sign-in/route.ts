import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const rows = await queryAssignments<{ id: string; name: string; password_hash: string; role: "teacher" | "student" }>("SELECT id, name, password_hash, role FROM users WHERE email = ? LIMIT 1", [input.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await verifyPassword(input.password, user.password_hash))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }
}
