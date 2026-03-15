"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RichEditorLazy } from "@/components/RichEditorLazy";
import { getDraftKey, getDraft, setDraft as saveDraftToStorage, clearDraft } from "@/lib/admin-drafts";

export function OutlineEditor({
  tournamentId,
  initialDraft,
  initialPublished, // reserved for future published preview
  publishedAt,
}: {
  tournamentId: string;
  initialDraft: string;
  initialPublished: string;
  publishedAt: string | null;
}) {
  void initialPublished;
  const router = useRouter();
  const draftKey = getDraftKey("outline", tournamentId);
  const [draft, setDraftState] = useState(() => getDraft(draftKey) ?? initialDraft);
  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      saveDraftToStorage(draftKey, value);
    },
    [draftKey]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  async function saveDraft() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다." });
        return;
      }
      clearDraft(draftKey);
      setMessage({ type: "ok", text: "저장되었습니다." });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "게시에 실패했습니다." });
        return;
      }
      clearDraft(draftKey);
      setMessage({ type: "ok", text: "게시되었습니다." });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      <RichEditorLazy
        value={draft}
        onChange={setDraft}
        placeholder="대회요강을 작성하세요"
        minHeight="320px"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveDraft}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "저장중" : "임시저장"}
        </button>
        <button
          type="button"
          onClick={() => setPreviewHtml(draft)}
          className="px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50"
        >
          미리보기
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={loading}
          className="px-4 py-2 bg-site-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          게시
        </button>
      </div>
      {publishedAt && (
        <p className="text-sm text-gray-500">
          마지막 게시: {new Date(publishedAt).toLocaleString("ko-KR")}
        </p>
      )}

      {previewHtml !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">미리보기</h2>
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            <div
              className="prose prose-sm max-w-none break-words overflow-hidden"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
