"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentAssignmentList } from "@/components/student-assignment-list";
import { SignOutButton } from "@/components/sign-out-button";
import { CheckCircle2, ClipboardList, LoaderCircle, Send } from "lucide-react";

type Viva = { id: string; status: "sent" | "in_progress" | "student_review" | "completed" | "follow_up"; due_at: string | null; title: string; student_name: string; updated_at: string; report_shared_at: string | null };
type Classroom = { id: string; name: string; teacher_name: string };

const labels = { sent: "To do", in_progress: "In progress", student_review: "Review needed", completed: "Completed", follow_up: "Follow-up" } as const;

export function StudentVivaDashboard() {
  const router = useRouter();
  const [code, setCode] = useState(""); const [classes, setClasses] = useState<Classroom[]>([]); const [vivas, setVivas] = useState<Viva[]>([]); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  async function refresh() { const [classResponse, vivaResponse] = await Promise.all([fetch("/api/classes/mine"), fetch("/api/vivas")]); const classPayload = await classResponse.json() as { classes?: Classroom[]; error?: string }; const vivaPayload = await vivaResponse.json() as { vivas?: Viva[]; error?: string }; if (!classResponse.ok) throw new Error(classPayload.error); if (!vivaResponse.ok) throw new Error(vivaPayload.error); setClasses(classPayload.classes ?? []); setVivas(vivaPayload.vivas ?? []); }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, []);
  async function join(event: FormEvent) { event.preventDefault(); setPending(true); setError(null); try { const response = await fetch("/api/classes/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error); setCode(""); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not join class."); } finally { setPending(false); } }
  async function start(viva: Viva) {
    setError(null);
    try {
      const status = "in_progress";
      const response = await fetch(`/api/vivas/${viva.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not start Viva.");
      setVivas((items) => items.map((item) => item.id === viva.id ? { ...item, status: "in_progress" } : item));
      router.push(`/vivas/${viva.id}`);

    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not start Viva."); }
  }
  const active = vivas.filter((viva) => viva.status !== "completed"); const completed = vivas.filter((viva) => viva.status === "completed");
  return <main className="min-h-screen bg-white px-5 py-8 text-[#171717] sm:px-8"><div className="mx-auto max-w-5xl"><div className="mb-4 flex justify-end"><SignOutButton /></div><section className="rounded-[2rem] bg-[#FBE994] p-7 sm:p-10"><p className="text-xs font-semibold tracking-[.14em] uppercase text-[#695915]">Student workspace</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em]">Your Vivas and assignments.</h1><p className="mt-4 max-w-2xl leading-7 text-[#51491e]">Join your teacher’s class, upload your assignment, and complete each evidence conversation when it is sent to you.</p><Link className="mt-5 inline-flex rounded-full bg-[#171717] px-4 py-2 text-sm font-semibold text-white" href="/upload">Upload an assignment</Link></section><div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><aside className="rounded-[1.5rem] border border-[#e7e3d8] p-5"><h2 className="font-serif text-2xl">Your classes</h2><form className="mt-5 flex gap-2" onSubmit={join}><input className="min-w-0 flex-1 rounded-xl border border-[#d8d3c8] px-3 py-2 uppercase" maxLength={8} onChange={(e) => setCode(e.target.value)} placeholder="JOIN CODE" required value={code}/><button className="rounded-xl bg-[#171717] px-3 text-white" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin"/> : <Send className="size-4"/>}</button></form><div className="mt-5 space-y-3">{classes.map((item) => <article className="rounded-xl bg-[#faf9f5] p-3" key={item.id}><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-[#655d52]">Teacher: {item.teacher_name}</p></article>)}{classes.length === 0 ? <p className="text-sm leading-6 text-[#655d52]">Enter the eight-character code your teacher shared to join their class.</p> : null}<StudentAssignmentList /></div></aside><section><div className="flex items-center gap-2"><ClipboardList className="size-5"/><h2 className="font-serif text-3xl">To do</h2></div><div className="mt-4 space-y-3">{active.map((viva) => <article className="rounded-[1.25rem] border border-[#e7e3d8] bg-white p-5 shadow-[0_12px_28px_rgba(70,55,30,.05)]" key={viva.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{viva.title}</p><p className="mt-1 text-sm text-[#655d52]">{labels[viva.status]}</p></div><button className="rounded-full bg-[#171717] px-4 py-2 text-sm font-semibold text-white" onClick={() => void start(viva)}>{viva.status === "in_progress" ? "Continue Viva" : "Start Viva"}</button></div></article>)}{active.length === 0 ? <p className="rounded-[1.25rem] border border-dashed border-[#d8d3c8] p-8 text-center text-sm text-[#655d52]">No Vivas are waiting for you yet.</p> : null}</div><h2 className="mt-8 flex items-center gap-2 font-serif text-2xl"><CheckCircle2 className="size-5"/>Completed</h2><div className="mt-4 space-y-3">{completed.map((viva) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf9f5] p-4" key={viva.id}><div><p className="font-semibold">{viva.title}</p><p className="mt-1 text-sm text-[#655d52]">{viva.report_shared_at ? "Your teacher shared the conversation report." : "Conversation and review complete. Your teacher will share the report when it is ready."}</p></div>{viva.report_shared_at ? <Link className="rounded-full bg-[#171717] px-4 py-2 text-sm font-semibold text-white" href={`/vivas/${viva.id}/report`}>View report</Link> : null}</article>)}{completed.length === 0 ? <p className="text-sm text-[#655d52]">Completed conversations will appear here.</p> : null}</div></section></div>{error ? <p className="mt-5 text-sm text-red-700">{error}</p> : null}</div></main>;
}
