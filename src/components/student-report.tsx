"use client";

import { ArrowLeft, CheckCircle2, Download, FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WorkspaceBanner } from "@/components/workspace-banner";
import type { FindingStatus } from "@/lib/dossier-types";
import type { VivaSessionState } from "@/lib/session-state";

const labels: Record<FindingStatus, string> = {
  demonstrated: "Clear understanding",
  partially_demonstrated: "Some understanding shown",
  needs_review: "A point to revisit",
  not_demonstrated: "Not discussed",
};

export function StudentReport({ session }: { session: VivaSessionState }) {
  const dossier = session.dossier!;
  const demonstrated = dossier.findings.filter((finding) => finding.status === "demonstrated").length;
  const revisit = dossier.findings.length - demonstrated;

  return (
    <main className="viva-print-root min-h-screen bg-white px-5 py-8 text-[#171717] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 print:hidden"><Link className="inline-flex items-center gap-2 text-sm font-semibold" href="/my-vivas"><ArrowLeft className="size-4" />Back to My Vivas</Link></div>
        <WorkspaceBanner
          actions={<Button className="print:hidden" onClick={() => window.print()} variant="outline"><Download />Save report as PDF</Button>}
          audience="Student report"
          description="This report reflects the evidence and answers from your Viva conversation. It does not decide authorship or AI use."
          tip="Use this report to understand what you explained clearly and what you can revisit with your teacher."
          title="Your Viva conversation report."
        />
        <section className="mt-8 rounded-[2rem] border border-[#e7e3d8] bg-white p-6 shadow-[0_16px_34px_rgba(80,65,25,0.06)] sm:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] uppercase text-[#746a5b]"><FileText className="size-3.5" />{session.submission.title}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">What the conversation showed.</h1>
          <p className="mt-4 max-w-3xl leading-7 text-[#554b28]">{dossier.summary}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-[1.25rem] bg-[#FBE994] p-4"><p className="text-2xl font-semibold">{demonstrated}</p><p className="mt-1 text-sm font-medium">Clear points</p></div><div className="rounded-[1.25rem] bg-[#fff8dc] p-4"><p className="text-2xl font-semibold">{revisit}</p><p className="mt-1 text-sm font-medium">Points to revisit</p></div><div className="rounded-[1.25rem] bg-[#f5f4f1] p-4"><p className="text-2xl font-semibold">{dossier.notTested.length}</p><p className="mt-1 text-sm font-medium">Not discussed</p></div></div>
        </section>
        <section className="mt-8 space-y-4"><h2 className="flex items-center gap-2 text-2xl font-semibold"><CheckCircle2 className="size-5" />Discussion notes</h2>{dossier.findings.map((finding) => <article className="rounded-[1.5rem] border border-[#e7e3d8] bg-white p-5" key={finding.claimId}><p className="text-xs font-semibold tracking-[.13em] uppercase text-[#746a5b]">{labels[finding.status]}</p><p className="mt-3 leading-7 text-[#292824]">{finding.observation}</p></article>)}</section>
      </div>
    </main>
  );
}