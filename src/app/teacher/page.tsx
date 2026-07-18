import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function TeacherPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "teacher") redirect(user.role === "student" ? "/my-vivas" : "/demo");
  redirect("/classes");
}