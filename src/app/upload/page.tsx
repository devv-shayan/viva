import { redirect } from "next/navigation";

import { StudentAssignmentUpload } from "@/components/student-assignment-upload";
import { getCurrentUser } from "@/lib/auth";

export default async function UploadAssignmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect(user.role === "teacher" ? "/classes" : "/demo");

  return <StudentAssignmentUpload />;
}