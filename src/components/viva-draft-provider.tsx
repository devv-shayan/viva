"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { DefenseDraft } from "@/lib/session-state";

type VivaDraftContextValue = {
  clearDraft: () => void;
  draft: DefenseDraft | null;
  setDraft: (draft: DefenseDraft) => void;
};

const VivaDraftContext = createContext<VivaDraftContextValue | null>(null);

export function VivaDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DefenseDraft | null>(null);

  return <VivaDraftContext.Provider value={{ clearDraft: () => setDraft(null), draft, setDraft }}>{children}</VivaDraftContext.Provider>;
}

export function useVivaDraft() {
  const context = useContext(VivaDraftContext);
  if (!context) throw new Error("useVivaDraft must be used within VivaDraftProvider.");
  return context;
}