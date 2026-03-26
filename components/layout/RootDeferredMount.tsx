"use client";

import dynamic from "next/dynamic";

/** 초기 번들에서 분리: 개발/푸시 로그, SW, 알림, 플로팅 버튼 — 첫 페인트 직후 로드 */
const ClientPerfLogger = dynamic(
  () => import("@/components/ClientPerfLogger").then((m) => ({ default: m.ClientPerfLogger })),
  { ssr: false }
);

const RegisterServiceWorker = dynamic(
  () => import("@/components/push/RegisterServiceWorker").then((m) => ({ default: m.RegisterServiceWorker })),
  { ssr: false }
);

const NotificationBanner = dynamic(() => import("@/components/NotificationBanner"), {
  ssr: false,
});

const AdminFloatButton = dynamic(
  () => import("@/components/AdminFloatButton").then((m) => ({ default: m.AdminFloatButton })),
  { ssr: false }
);

const ClientFloatButton = dynamic(
  () => import("@/components/ClientFloatButton").then((m) => ({ default: m.ClientFloatButton })),
  { ssr: false }
);

export function RootDeferredMount() {
  return (
    <>
      <ClientPerfLogger />
      <RegisterServiceWorker />
      <NotificationBanner />
      <AdminFloatButton />
      <ClientFloatButton />
    </>
  );
}
