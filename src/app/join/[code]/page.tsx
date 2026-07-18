import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { queryAssignments } from "@/lib/cloudflare-assignments";

export default async function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rows = await queryAssignments<{ name: string; teacher_name: string }>("SELECT classes.name, users.name AS teacher_name FROM classes JOIN users ON users.id = classes.teacher_id WHERE classes.join_code = ? LIMIT 1", [code.toUpperCase()]);
  const classroom = rows[0];
  if (!classroom) return <main className="grid min-h-screen place-items-center bg-white px-5"><div className="text-center"><h1 className="text-3xl font-bold">This invite is not available.</h1><Link className="mt-5 inline-block font-semibold underline" href="/">Return to Viva</Link></div></main>;
  return <AuthForm invite={{ code: code.toUpperCase(), classroom }} mode="sign-up" />;
}
