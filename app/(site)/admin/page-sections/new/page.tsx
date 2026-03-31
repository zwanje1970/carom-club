import { redirect } from "next/navigation";

/** CMS 블록 추가는 페이지 빌더에서만 (페이지·순서·배치 일관성) */
export default function NewPageSectionPage() {
  redirect("/admin/page-builder");
}
