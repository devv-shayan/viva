"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceBanner } from "@/components/workspace-banner";

export function StudentAssignmentUpload() {
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    void fetch("/api/classes/mine").then(async (response) => {
      const payload = (await response.json()) as { classes?: Array<{ id: string; name: string }> };
      if (response.ok) { setClasses(payload.classes ?? []); setClassId(payload.classes?.[0]?.id ?? ""); }
    });
  }, []);

  async function upload() {
    if (!file) {
      setMessage("Choose your PDF or DOCX assignment first.");
      return;
    }
    setMessage(null);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("classId", classId);
      form.set("title", title);
      const response = await fetch("/api/assignments/upload", { body: form, method: "POST" });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const payload = isJson ? (await response.json()) as { error?: string } : null;
      if (!response.ok) throw new Error(payload?.error || "The upload service is temporarily unavailable. Please try again in a moment.");
      router.replace("/my-vivas");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the assignment.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <WorkspaceBanner audience="Student workspace" description="Upload the assignment your teacher will discuss with you. Viva keeps the original file and uses its text only to prepare the conversation." tip="After uploading, ask your teacher to choose this assignment from their workspace." title="Share your assignment." />
        <section className="mt-8 rounded-[1.5rem] border border-[#e7e3d8] bg-white p-5 shadow-[0_14px_35px_rgba(70,55,30,0.06)] sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Class<select className="rounded-xl border border-[#d8d3c8] px-3 py-2.5" onChange={(event) => setClassId(event.target.value)} required value={classId}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            
            <label className="grid gap-2 text-sm font-medium">Assignment title<Input onChange={(event) => setTitle(event.target.value)} placeholder="Congestion pricing essay" value={title} /></label>
          </div>
          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-[#cdb65d] bg-[#fff9dc] p-5 text-sm font-medium">
            <span className="flex items-center gap-3"><FileText className="size-5" />{file ? file.name : "Choose PDF or DOCX"}</span>
            <input accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
          <p className="mt-3 text-sm text-[#746a5b]">PDF or DOCX, up to 10 MB. The original stays in private Cloudflare storage.</p>
          <Button className="mt-6 bg-[#171717] text-white hover:bg-[#303030]" disabled={!file || !classId || isUploading} onClick={upload}>{isUploading ? <LoaderCircle className="animate-spin" /> : <FileText />}{isUploading ? "Uploading assignment…" : "Share with teacher"}</Button>
          {message ? <p className="mt-5 text-sm leading-6 text-[#5d5548]" role="status">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
