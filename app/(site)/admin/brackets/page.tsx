import { redirect } from "next/navigation";

/** 대진표는 대회 상세에서 관리 */
export default function AdminBracketsPage() {
  redirect("/admin/tournaments");
}
