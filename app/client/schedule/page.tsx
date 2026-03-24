import { redirect } from "next/navigation";

/** 일정/예약 UI는 추후 제공 — 대시보드의 오늘 일정으로 안내 */
export default function ClientSchedulePage() {
  redirect("/client/dashboard");
}
