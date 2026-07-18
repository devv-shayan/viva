import "server-only";

import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";

import { queryAssignments } from "@/lib/cloudflare-assignments";

export type AppRole = "teacher" | "student" | "judge";

type SessionUser = { id: string; name: string; email: string; role: AppRole };

const SESSION_COOKIE = "viva_session";
const SESSION_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return hash(password);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return verify(passwordHash, password);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await queryAssignments(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    [crypto.randomUUID(), userId, hashToken(token), expiresAt.toISOString()],
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await queryAssignments("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await queryAssignments<SessionUser>(
    "SELECT users.id, users.name, users.email, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1",
    [hashToken(token), new Date().toISOString()],
  );
  return rows[0] ?? null;
}

export async function requireRole(role: AppRole) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Sign in is required.");
  if (user.role !== role) throw new AuthError(403, "You do not have access to this action.");
  return user;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}
