"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RichEditorLazy } from "@/components/RichEditorLazy";
import { getDraftKey, getDraft, setDraft as saveDraftToStorage, clearDraft } from "@/lib/admin-drafts";

export function OutlineEditor({
  tournamentId,
  initialDraft,
  initialPublished,
  publishedAt,
  initialOutlinePdfUrl = null,
  initialPosterImageUrl = null,
}: {
  tournamentId: string;
  initialDraft: string;
  initialPublished: string;
  publishedAt: string | null;
  initialOutlinePdfUrl?: string | null;
  initialPosterImageUrl?: string | null;
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
  const [useEditor, setUseEditor] = useState(true);
  const [usePdf, setUsePdf] = useState(() => !!initialOutlinePdfUrl);
  const [useImage, setUseImage] = useState(() => !!initialPosterImageUrl);
  const [outlinePdfUrl, setOutlinePdfUrl] = useState<string | null>(initialOutlinePdfUrl ?? null);
  const [posterImageUrl, setPosterImageUrl] = useState<string | null>(initialPosterImageUrl ?? null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
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
        body: JSON.stringify({
          draft: useEditor ? draft : "",
          outlinePdfUrl: usePdf ? outlinePdfUrl : null,
          posterImageUrl: useImage ? posterImageUrl : null,
        }),
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
        body: JSON.stringify({
          publish: useEditor ? draft : "",
          outlinePdfUrl: usePdf ? outlinePdfUrl : null,
          posterImageUrl: useImage ? posterImageUrl : null,
        }),
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

  async function onPdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-pdf", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setOutlinePdfUrl(data.url);
      setMessage({ type: "ok", text: "PDF가 업로드되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "PDF 업로드 실패" });
    } finally {
      setPdfUploading(false);
      e.target.value = "";
    }
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("policy", "tournament");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setPosterImageUrl(data.url);
      setMessage({ type: "ok", text: "포스터 이미지가 업로드되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "이미지 업로드 실패" });
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-4 border-b border-gray-200 pb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useEditor} onChange={(e) => setUseEditor(e.target.checked)} className="rounded border-gray-300" />
          <span className="text-sm font-medium">에디터 내용</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={usePdf} onChange={(e) => setUsePdf(e.target.checked)} className="rounded border-gray-300" />
          <span className="text-sm font-medium">PDF 파일</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} className="rounded border-gray-300" />
          <span className="text-sm font-medium">이미지(포스터)</span>
        </label>
      </div>
      {useEditor && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">에디터 내용</p>
          <RichEditorLazy
            value={draft}
            onChange={setDraft}
            placeholder="대회요강을 작성하세요"
            minHeight="320px"
          />
        </div>
      )}
      {usePdf && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">PDF 파일</p>
          <input type="file" accept="application/pdf" onChange={onPdfChange} disabled={pdfUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-site-primary/10 file:text-site-primary hover:file:bg-site-primary/20" />
          {outlinePdfUrl && (
            <p className="text-sm text-gray-600">
              등록됨: <a href={outlinePdfUrl} target="_blank" rel="noopener noreferrer" className="text-site-primary underline">{outlinePdfUrl.slice(0, 60)}…</a>
              <button type="button" onClick={() => setOutlinePdfUrl(null)} className="ml-2 text-red-600 text-xs">삭제</button>
            </p>
          )}
        </div>
      )}
      {useImage && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">포스터/대표 이미지</p>
          <input type="file" accept="image/*" onChange={onImageChange} disabled={imageUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-site-primary/10 file:text-site-primary hover:file:bg-site-primary/20" />
          {posterImageUrl && (
            <div className="flex items-center gap-3">
              <img src={posterImageUrl} alt="포스터" className="h-24 w-auto object-contain rounded border border-gray-200" />
              <button type="button" onClick={() => setPosterImageUrl(null)} className="text-red-600 text-sm">삭제</button>
            </div>
          )}
        </div>
      )}
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
