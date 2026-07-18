"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return <button className="inline-flex items-center gap-2 rounded-full border border-[#d8d3c8] bg-white px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-[#fff9dc] disabled:opacity-60" disabled={pending} onClick={() => void signOut()}>{pending ? "Signing out…" : <><LogOut className="size-4" />Logout</>}</button>;
}