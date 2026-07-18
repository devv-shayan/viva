import { notFound, redirect } from "next/navigation";

import { StudentReport } from "@/components/student-report";
import { getCurrentUser } from "@/lib/auth";
import { queryAssignments } from "@/lib/cloudflare-assignments";
import { VivaSessionSchema } from "@/lib/session-state";

export default async function StudentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect(user.role === "teacher" ? "/classes" : "/demo");
  const { id } = await params;
  const rows = await queryAssignments<{ session_state: string | null }>(
    "SELECT session_state FROM vivas WHERE id = ? AND student_id = ? AND report_shared_at IS NOT NULL LIMIT 1",
    [id, user.id],
  );
  if (!rows[0]?.session_state) notFound();
  const session = VivaSessionSchema.parse(JSON.parse(rows[0].session_state));
  if (!session.dossier) notFound();

  return <StudentReport session={session} />;
}