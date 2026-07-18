"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode, invite }: { mode: Mode; invite?: { code: string; classroom: { name: string; teacher_name: string } } }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"teacher" | "student">(invite ? "student" : "teacher");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === "sign-in" ? "sign-in" : "sign-up"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "sign-up" ? { name, email, password, role, inviteCode: invite?.code } : { email, password }) });
      const payload = (await response.json()) as { error?: string; user?: { role: string } };
      if (!response.ok || !payload.user) throw new Error(payload.error || "Could not continue.");
      router.push(payload.user.role === "teacher" ? "/classes" : "/my-vivas"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not continue."); }
    finally { setPending(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-white px-5 py-8"><form className="w-full max-w-md rounded-[2rem] border border-[#e7e3d8] bg-white p-7 shadow-[0_18px_45px_rgba(70,55,30,.08)]" onSubmit={submit}><p className="text-sm font-semibold text-[#78651a]">VIVA</p><h1 className="mt-3 text-3xl font-bold">{mode === "sign-in" ? "Welcome back." : invite ? `Join ${invite.classroom.name}` : "Create your teacher workspace."}</h1><p className="mt-3 text-sm leading-6 text-[#655d52]">{mode === "sign-in" ? "Sign in to access your classes and conversations." : invite ? `${invite.classroom.teacher_name} invited you to join this class.` : "Create a workspace, invite students, and run fair evidence conversations."}</p>{mode === "sign-up" ? <><label className="mt-6 block text-sm font-medium">Name<input className="mt-2 w-full rounded-xl border border-[#d8d3c8] px-3 py-2.5" onChange={(e) => setName(e.target.value)} required value={name}/></label>{!invite ? <label className="mt-5 block text-sm font-medium">I am a<select className="mt-2 w-full rounded-xl border border-[#d8d3c8] px-3 py-2.5" onChange={(e) => setRole(e.target.value as "teacher" | "student")} value={role}><option value="teacher">Teacher</option><option value="student">Student</option></select></label> : null}</> : null}<label className="mt-5 block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border border-[#d8d3c8] px-3 py-2.5" onChange={(e) => setEmail(e.target.value)} required type="email" value={email}/></label><label className="mt-5 block text-sm font-medium">Password<input className="mt-2 w-full rounded-xl border border-[#d8d3c8] px-3 py-2.5" minLength={mode === "sign-up" ? 12 : 1} onChange={(e) => setPassword(e.target.value)} required type="password" value={password}/></label>{error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}<button className="mt-6 w-full rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending}>{pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button><p className="mt-5 text-center text-sm text-[#655d52]">{mode === "sign-in" ? <>New to Viva? <Link className="font-semibold underline" href="/sign-up">Create account</Link></> : <>Already have an account? <Link className="font-semibold underline" href="/sign-in">Sign in</Link></>}</p></form></main>;
}
