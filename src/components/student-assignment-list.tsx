"use client";

import { useEffect, useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";

type Assignment = {
  id: string;
  title: string;
  file_name: string;
  class_name: string | null;
};

export function StudentAssignmentList() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/assignments")
      .then(async (response) => {
        const payload = (await response.json()) as { assignments?: Assignment[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load assignments.");
        setAssignments(payload.assignments ?? []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load assignments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-6 border-t border-[#e7e3d8] pt-5">
      <h2 className="font-serif text-2xl">Submitted work</h2>
      {loading ? <p className="mt-3 flex items-center gap-2 text-sm text-[#655d52]"><LoaderCircle className="size-4 animate-spin" />Loading submissions</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && assignments.length === 0 ? <p className="mt-3 text-sm leading-6 text-[#655d52]">Your uploaded assignments will appear here for you and your teacher.</p> : null}
      <div className="mt-3 space-y-2">
        {assignments.map((assignment) => (
          <article className="rounded-xl bg-[#fff9dc] p-3" key={assignment.id}>
            <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">{assignment.title}</p><p className="mt-1 break-all text-xs text-[#655d52]">{assignment.file_name}</p>{assignment.class_name ? <p className="mt-1 text-xs font-semibold text-[#695915]">Class: {assignment.class_name}</p> : null}</div></div>
          </article>
        ))}
      </div>
    </section>
  );
}