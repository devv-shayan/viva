import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect(user.role === "teacher" ? "/classes" : "/demo");
  redirect("/my-vivas");
}