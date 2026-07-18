import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenText, CirclePlay, LockKeyhole, MessageCircleMore } from "lucide-react";

const workspaces = [
  {
    href: "/teacher",
    icon: BookOpenText,
    label: "Teacher workspace",
    title: "Prepare the conversation",
    description:
      "Choose an essay, focus the discussion, and review evidence after the student finishes.",
    action: "Open teacher workspace",
    disabled: false,
  },
  {
    href: "/student",
    icon: MessageCircleMore,
    label: "Student workspace",
    title: "Explain your thinking",
    description:
      "Read the introduction, speak about the essay, and check the conversation record.",
    action: "Open student workspace",
    disabled: true,
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-white px-5 py-5 text-[#171717] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold tracking-[-0.05em]">
            <span aria-hidden="true" className="flex gap-1">
              <span className="h-7 w-1.5 -skew-x-12 rounded-full bg-[#f2c94c]" />
              <span className="h-7 w-1.5 -skew-x-12 rounded-full bg-[#f2c94c]" />
            </span>
            <span className="text-2xl">viva</span>
          </div>
          <p className="rounded-full bg-[#f5f4f1] px-4 py-2 text-sm font-medium text-[#34312d]">
            Evidence-led review
          </p>
        </header>

        <section className="mt-10 grid overflow-hidden rounded-[2rem] bg-[#FBE994] md:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.85fr)] lg:mt-14">
          <div className="flex min-h-[30rem] flex-col justify-center px-7 py-10 sm:px-12 lg:px-16">
            <p className="text-sm font-semibold text-[#5f5018]">A fairer way to review work</p>
            <h1 className="mt-4 max-w-lg text-4xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Hear the thinking behind the work.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#38331f] sm:text-lg">
              Viva helps teachers and students discuss an essay using the evidence that is already on the page.
            </p>
            <p className="mt-7 max-w-md text-sm leading-6 text-[#554b28]">
              It does not decide who wrote the work or make accusations.
            </p>
          </div>

          <div className="flex items-center bg-white/30 p-5 sm:p-8">
            <div className="grid w-full gap-4">
              {workspaces.map((workspace) => {
                const Icon = workspace.icon;
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#FBE994] text-[#171717]">
                        <Icon className="size-5" strokeWidth={2.25} />
                      </span>
                      <ArrowUpRight className="size-5 text-[#171717] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-7 text-sm font-semibold text-[#6b6040]">
                      {workspace.label}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">
                      {workspace.title}
                    </h2>
                    <p className="mt-3 max-w-md leading-6 text-[#5f5a50]">
                      {workspace.description}
                    </p>
                    <span className="mt-6 inline-flex rounded-full bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">
                      {workspace.action}
                    </span>
                  </>
                );

                if (!workspace.disabled) {
                  return (
                    <Link
                      className="group rounded-[1.5rem] bg-white p-6 shadow-[0_18px_40px_rgba(95,76,12,0.10)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(95,76,12,0.16)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717] active:translate-y-0"
                      href={workspace.href}
                      key={workspace.href}
                    >
                      {cardContent}
                    </Link>
                  );
                }

                return (
                  <article
                    aria-label="Student workspace unavailable until a conversation is created"
                    className="relative min-h-[19rem] overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_40px_rgba(95,76,12,0.10)]"
                    key={workspace.href}
                  >
                    <div aria-hidden="true" className="pointer-events-none select-none blur-[2px] opacity-40">
                      <div className="p-6">{cardContent}</div>
                    </div>
                    <div className="absolute inset-0 grid place-items-center bg-white/45 p-5 backdrop-blur-[2px]">
                      <div className="max-w-[16rem] rounded-2xl border border-[#e7e3d8] bg-white/95 p-4 text-center shadow-[0_12px_28px_rgba(70,55,30,0.10)]">
                        <LockKeyhole className="mx-auto size-5 text-[#5f5018]" />
                        <p className="mt-2 font-semibold tracking-[-0.02em]">Start with the teacher</p>
                        <p className="mt-1 text-sm leading-5 text-[#655d52]">
                          Create a conversation before opening the student workspace.
                        </p>
                        <Link
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#171717] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#303030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
                          href="/teacher"
                        >
                          Create conversation <ArrowRight className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
              <Link
                className="group flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/70 bg-[#171717] p-5 text-white shadow-[0_18px_40px_rgba(40,30,5,0.12)] transition duration-200 hover:-translate-y-1 hover:bg-[#303030] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717] active:translate-y-0"
                href="/demo"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#FBE994] text-[#171717]">
                    <CirclePlay className="size-5" strokeWidth={2.25} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Judge demo</span>
                    <span className="mt-0.5 block text-sm text-white/70">Watch a sample defense</span>
                  </span>
                </span>
                <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-6 text-[#6b665d]">
          This demo keeps the consented conversation on this browser. A full release needs secure teacher and student accounts.
        </p>
      </div>
    </main>
  );
}
