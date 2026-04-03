"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";

export type MobileHeaderProps = {
  title: string;
  /** 우측 뒤로가기 버튼 표시 여부 */
  showBack?: boolean;
  /** 좌측 나가기(종료) 버튼 표시 여부 */
  showExit?: boolean;
  /** 나가기 버튼 클릭 시 이동 경로 (웹용) */
  onExitPath?: string;
  /** @deprecated showExit 사용 권장 */
  showClose?: boolean;
  /** @deprecated onExitPath 사용 권장 */
  onClosePath?: string;
  /** @deprecated 작성 취소 확인 */
  confirmClose?: boolean;
};

/**
 * 공통 모바일 헤더
 * - 좌측: 나가기 (앱 종료 또는 홈 이동)
 * - 중앙: 페이지 제목
 * - 우측: 뒤로가기 (history.back)
 */
export default function MobileHeader({
  title,
  showBack = true,
  showExit = true,
  onExitPath = "/",
  showClose,
  onClosePath,
}: MobileHeaderProps) {
  const router = useRouter();
  type ReactNativeWebViewWindow = Window & {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  };

  const finalShowExit = showExit || showClose;
  const finalExitPath = onClosePath || onExitPath;

  const handleExit = () => {
    // WebView 환경에서 앱 종료 인터페이스 호출
    const webViewWindow = window as ReactNativeWebViewWindow;
    if (typeof window !== "undefined" && webViewWindow.ReactNativeWebView) {
      webViewWindow.ReactNativeWebView.postMessage(JSON.stringify({ type: "EXIT_APP" }));
      return;
    }
    // 웹 환경에서는 홈 이동
    router.push(finalExitPath);
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:bg-slate-950 dark:border-slate-800 md:hidden">
      {/* 좌측: 나가기 버튼 */}
      <div className="w-10">
        {finalShowExit && (
          <button
            type="button"
            onClick={handleExit}
            className="rounded-full p-2 -ml-2 transition-transform transition-colors active:bg-gray-100 active:scale-95 text-gray-700 dark:text-slate-300"
            aria-label="나가기"
          >
            <LogOut size={24} />
          </button>
        )}
      </div>

      {/* 중앙: 제목 */}
      <h1 className="flex-1 truncate text-center text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h1>

      {/* 우측: 뒤로가기 버튼 */}
      <div className="flex w-10 justify-end">
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-2 -mr-2 transition-transform transition-colors active:bg-gray-100 active:scale-95 text-gray-700 dark:text-slate-300"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} />
          </button>
        )}
      </div>
    </header>
  );
}
