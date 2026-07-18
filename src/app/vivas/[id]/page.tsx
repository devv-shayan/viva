import { redirect } from "next/navigation";

import { VivaExperience } from "@/components/viva-experience";
import { getCurrentUser } from "@/lib/auth";

export default async function AssignedVivaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role === "judge") redirect("/demo");
  const { id } = await params;

  return <VivaExperience role={user.role} vivaId={id} />;
}