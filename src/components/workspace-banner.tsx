import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceBannerProps = {
  actions?: ReactNode;
  audience: string;
  className?: string;
  description: string;
  tip: string;
  title: string;
};

export function WorkspaceBanner({
  actions,
  audience,
  className,
  description,
  tip,
  title,
}: WorkspaceBannerProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[2rem] bg-[#FBE994] px-6 py-7 text-[#171717] sm:px-8 sm:py-9",
        className,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#5f5018] uppercase">
            {audience}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#403816]">{description}</p>
        </div>

        <aside className="rounded-[1.25rem] bg-white/70 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4" strokeWidth={2} /> Useful now
          </div>
          <p className="mt-2 text-sm leading-6 text-[#554b28]">{tip}</p>
          {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
        </aside>
      </div>
    </section>
  );
}
