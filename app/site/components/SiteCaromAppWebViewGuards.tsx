"use client";

import CaromAppWebViewLifecycleGuards from "../../components/CaromAppWebViewLifecycleGuards";

/** 공개 /site 모바일 셸: 서버 앱 판정 + 클라이언트 Bridge/UA 보강으로 lifecycle 가드 활성화 */
export default function SiteCaromAppWebViewGuards({ appShell }: { appShell: boolean }) {
  return <CaromAppWebViewLifecycleGuards enabled={appShell} />;
}
