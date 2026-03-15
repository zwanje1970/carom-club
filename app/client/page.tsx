import { redirect } from "next/navigation";

/** /client 진입 시 대시보드로 이동 (로그인 후 404 방지) */
export default function ClientPage() {
  redirect("/client/dashboard");
}
