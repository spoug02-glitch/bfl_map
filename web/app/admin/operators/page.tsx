import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OperatorsPage from "@/components/admin/OperatorsPage";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export default async function AdminOperatorsPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) redirect("/admin/login");
  if (session.role !== "super_admin") redirect("/admin");
  return <OperatorsPage />;
}
