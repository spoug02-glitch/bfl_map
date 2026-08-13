import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) redirect("/admin/login");
  return <AdminDashboard role={session.role} />;
}
