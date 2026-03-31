import { redirect } from "next/navigation";

/** 콘텐츠·홍보는 /client/promo 로 통합 */
export default function ClientContentPage() {
  redirect("/client/promo");
}
