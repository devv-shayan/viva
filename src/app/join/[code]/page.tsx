import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { JoinClassConfirm } from "@/components/join-class-confirm";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export default async function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toUpperCase();
  const rows = await queryAssignments<{ name: string; teacher_name: string }>("SELECT classes.name, users.name AS teacher_name FROM classes JOIN users ON users.id = classes.teacher_id WHERE classes.join_code = ? LIMIT 1", [normalized]);
  const classroom = rows[0];
  if (!classroom) return <main className="grid min-h-screen place-items-center bg-white px-5"><div className="text-center"><h1 className="text-3xl font-bold">This invite is not available.</h1><Link className="mt-5 inline-block font-semibold underline" href="/">Return to Viva</Link></div></main>;

  const user = await getCurrentUser();

  // Already signed in as a student: skip sign-up and enroll straight into the class.
  if (user?.role === "student") {
    return <JoinClassConfirm code={normalized} className={classroom.name} teacherName={classroom.teacher_name} />;
  }

  // Signed in, but not as a student: a teacher/judge account cannot join a class.
  if (user) {
    return <main className="grid min-h-screen place-items-center bg-white px-5 py-8"><div className="w-full max-w-md rounded-[2rem] border border-[#e7e3d8] bg-white p-7 text-center shadow-[0_18px_45px_rgba(70,55,30,.08)]"><h1 className="text-3xl font-bold">Join {classroom.name}</h1><p className="mt-3 text-sm leading-6 text-[#655d52]">You are signed in as a {user.role}. Class invites are for student accounts. Sign out and sign up as a student to join this class.</p><div className="mt-6 flex flex-col items-center gap-3"><SignOutButton /><Link className="text-sm font-semibold underline" href={user.role === "teacher" ? "/classes" : "/demo"}>Back to your workspace</Link></div></div></main>;
  }

  // Not signed in: register (student) and enroll via the invite code.
  return <AuthForm invite={{ code: normalized, classroom }} mode="sign-up" />;
}
