"use client";

import { useRouter } from "next/navigation";
import { TeacherClassroomDashboard } from "@/components/classroom-dashboard";

export default function ClassesPage() {
  const router = useRouter();
  return <TeacherClassroomDashboard onContinue={(id) => router.push(`/classes/${id}/assignments`)} />;
}
