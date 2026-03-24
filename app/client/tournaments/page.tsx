import { redirect } from "next/navigation";

/** 내 대회 목록은 대회관리(/client/operations)와 동일 — 단일 진입점 유지 */
export default function ClientTournamentsListPage() {
  redirect("/client/operations");
}
