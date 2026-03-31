import { notFound } from "next/navigation";
import { E2ETroublePathClient } from "./E2ETroublePathClient";

/**
 * 개발 서버 또는 NEXT_PUBLIC_E2E_TROUBLE_PATH=1 일 때만 노출.
 * Playwright가 1목·경로선 UI를 실제 브라우저에서 검증할 때 사용.
 */
export default function E2ETroubleSolutionPathPage() {
  const enabled =
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_E2E_TROUBLE_PATH === "1";
  if (!enabled) {
    notFound();
  }
  return (
    <main className="min-h-screen bg-site-bg text-site-text" data-testid="e2e-trouble-path-page">
      <E2ETroublePathClient />
    </main>
  );
}
