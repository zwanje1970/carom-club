import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /apply → /apply/client 로 리다이렉트 (404 방지) */
export default function ApplyPage() {
  redirect("/apply/client");
}
