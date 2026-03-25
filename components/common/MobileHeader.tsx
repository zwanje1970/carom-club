"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

export type MobileHeaderProps = {
  title: string;
  /** 왼쪽 뒤로가기 버튼 */
  showBack?: boolean;
  /** 오른쪽 닫기 버튼 */
  showClose?: boolean;
  /** 닫기 버튼 클릭 시 이동 경로 */
  onClosePath?: string;
  /** 닫기 시 confirm 사용 */
  confirmClose?: boolean;
  confirmCloseMessage?: string;
};

export default function MobileHeader({
  title,
  showBack = true,
  showClose = true,
  onClosePath = "/",
  confirmClose = false,
  confirmCloseMessage = "작성 중인 내용을 취소하고 나갈까요?",
}: MobileHeaderProps) {
  const router = useRouter();

  const handleClose = () => {
    if (confirmClose && !window.confirm(confirmCloseMessage)) return;
    router.push(onClosePath);
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-100 bg-white/80 px-4 backdrop-blur-md shadow-sm">
      <div className="w-10">
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-2 -ml-2 transition-transform transition-colors active:bg-gray-100 active:scale-95"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
        )}
      </div>

      <h1 className="flex-1 truncate text-center text-base font-semibold text-gray-900">
        {title}
      </h1>

      <div className="flex w-10 justify-end">
        {showClose && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 -mr-2 transition-transform transition-colors active:bg-gray-100 active:scale-95"
            aria-label="닫기"
          >
            <X size={24} className="text-gray-700" />
          </button>
        )}
      </div>
    </header>
  );
}

