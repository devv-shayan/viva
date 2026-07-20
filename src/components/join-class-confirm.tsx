"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function JoinClassConfirm({ code, className, teacherName }: { code: string; className: string; teacherName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/classes/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not join this class.");
      router.replace("/my-vivas");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join this class.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-5 py-8">
      <div className="w-full max-w-md rounded-[2rem] border border-[#e7e3d8] bg-white p-7 shadow-[0_18px_45px_rgba(70,55,30,.08)]">
        <p className="text-sm font-semibold text-[#78651a]">VIVA</p>
        <h1 className="mt-3 text-3xl font-bold">Join {className}</h1>
        <p className="mt-3 text-sm leading-6 text-[#655d52]">{teacherName} invited you to join this class. You are already signed in, so just confirm to join.</p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={join}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : null}{pending ? "Joining…" : "Join class"}</button>
        <button className="mt-3 w-full rounded-full border border-[#e7e3d8] px-4 py-3 text-sm font-semibold" disabled={pending} onClick={() => router.replace("/my-vivas")}>Not now</button>
      </div>
    </main>
  );
}
