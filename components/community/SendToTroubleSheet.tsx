"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAllowedImageUrl } from "@/lib/image-src";

type Props = {
  noteId: string;
  defaultTitle: string;
  defaultContent: string;
  defaultImageUrl: string | null;
  onClose: () => void;
};

export function SendToTroubleSheet({
  noteId,
  defaultTitle,
  defaultContent,
  defaultImageUrl,
  onClose,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle || "");
  const [content, setContent] = useState(defaultContent || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    const urlTrim = (defaultImageUrl ?? "").trim();
    if (urlTrim && !isAllowedImageUrl(urlTrim)) {
      setError("노트에 저장된 이미지 주소를 사용할 수 없습니다. 노트에서 이미지를 다시 저장해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/community/trouble/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          noteId,
          title: title.trim(),
          content: content.trim(),
          imageUrl: urlTrim || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      console.log("[난구해결 등록] 응답 status:", res.status, "body:", { message: j.message, error: j.error, id: j.id });
      if (!res.ok) {
        const serverMessage = j.error ?? j.message ?? "등록에 실패했습니다.";
        console.error("[난구해결 등록] 실패:", res.status, serverMessage);
        throw new Error(serverMessage);
      }
      const { id } = j;
      onClose();
      router.push(`/community/trouble/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50 md:bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      {/* z-[110]: 모바일 하단 네비(z-50)보다 위 — 버튼이 가려지지 않도록 */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[110] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-slate-900 shadow-xl border border-gray-200 dark:border-slate-700"
        role="dialog"
        aria-labelledby="send-trouble-title"
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 id="send-trouble-title" className="text-lg font-semibold">난구해결로 보내기</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              제목과 설명을 확인한 뒤 등록하면 커뮤니티 난구해결 게시글로 올라갑니다.
              {defaultImageUrl ? " 노트에 저장된 공배치 이미지가 있으면 글에 함께 포함됩니다." : ""}
            </p>
            <div>
              <label htmlFor="send-trouble-title-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목 *</label>
              <input
                id="send-trouble-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="문제 제목"
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
              />
            </div>
            <div>
              <label htmlFor="send-trouble-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
              <textarea
                id="send-trouble-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="문제 설명 (선택)"
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
              />
            </div>
          </div>
          <div
            className="shrink-0 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pt-3 space-y-3"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-slate-600 font-medium touch-manipulation"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-lg bg-site-primary text-white font-medium hover:opacity-90 disabled:opacity-50 touch-manipulation"
              >
                {submitting ? "등록 중…" : "등록 후 보기"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
