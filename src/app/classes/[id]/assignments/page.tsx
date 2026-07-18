import { ClassAssignmentDelivery } from "@/components/class-assignment-delivery";
export default async function ClassAssignmentsPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ClassAssignmentDelivery classId={id} />; }
