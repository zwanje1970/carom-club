"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RichEditorLazy } from "@/components/RichEditorLazy";
import { formatKoreanDateTime } from "@/lib/format-date";
import { getDraftKey, getDraft, setDraft as saveDraftToStorage, clearDraft } from "@/lib/admin-drafts";
import type { PromoPageTemplateRow } from "@/lib/promo-templates";
import { PROMO_TEMPLATE_CATEGORIES } from "@/lib/promo-templates";

export function PromoEditor({
  organizationId,
  initialDraft,
  initialPublished,
  publishedAt,
  initialPromoPdfUrl = null,
  initialPromoImageUrl = null,
  apiPath,
}: {
  organizationId: string;
  initialDraft: string;
  initialPublished: string;
  publishedAt: string | null;
  initialPromoPdfUrl?: string | null;
  initialPromoImageUrl?: string | null;
  apiPath?: string;
}) {
  void initialPublished;
  const router = useRouter();
  const draftKey = getDraftKey("promo", organizationId);
  const [draft, setDraftState] = useState(() => getDraft(draftKey) ?? initialDraft);
  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      saveDraftToStorage(draftKey, value);
    },
    [draftKey]
  );
  const [useEditor, setUseEditor] = useState(true);
  const [usePdf, setUsePdf] = useState(() => !!initialPromoPdfUrl);
  const [useImage, setUseImage] = useState(() => !!initialPromoImageUrl);
  const [promoPdfUrl, setPromoPdfUrl] = useState<string | null>(initialPromoPdfUrl ?? null);
  const [promoImageUrl, setPromoImageUrl] = useState<string | null>(initialPromoImageUrl ?? null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [templateModal, setTemplateModal] = useState<"load" | "save" | null>(null);
  const [templateList, setTemplateList] = useState<PromoPageTemplateRow[]>([]);
  const [templateListLoading, setTemplateListLoading] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [saveTemplateCategory, setSaveTemplateCategory] = useState("CUSTOM");
  const [saveTemplateSubmitting, setSaveTemplateSubmitting] = useState(false);

  const patchUrl = apiPath ?? `/api/admin/venues/${organizationId}/promo`;

  useEffect(() => {
    if (templateModal !== "load") return;
    setTemplateListLoading(true);
    fetch("/api/admin/promo-templates", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: PromoPageTemplateRow[]) => setTemplateList(Array.isArray(list) ? list : []))
      .catch(() => setTemplateList([]))
      .finally(() => setTemplateListLoading(false));
  }, [templateModal]);

  function applyTemplate(t: PromoPageTemplateRow) {
    const isEmpty = !draft || draft.trim() === "" || draft === "<p></p>";
    if (!isEmpty && !window.confirm("현재 내용을 덮어쓰시겠습니까?")) return;
    setDraft(t.contentHtml || "<p></p>");
    setTemplateModal(null);
  }

  async function saveAsTemplate() {
    const name = saveTemplateName.trim();
    if (!name) {
      setMessage({ type: "error", text: "템플릿 이름을 입력해 주세요." });
      return;
    }
    setSaveTemplateSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/promo-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description: saveTemplateDesc.trim() || undefined,
          category: saveTemplateCategory,
          contentHtml: draft || "<p></p>",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다." });
        return;
      }
      setMessage({ type: "ok", text: "템플릿으로 저장되었습니다." });
      setTemplateModal(null);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
      setSaveTemplateCategory("CUSTOM");
    } finally {
      setSaveTemplateSubmitting(false);
    }
  }

  const categoryLabel = (cat: string) =>
    PROMO_TEMPLATE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  async function saveDraft() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: useEditor ? draft : "",
          promoPdfUrl: usePdf ? promoPdfUrl : null,
          promoImageUrl: useImage ? promoImageUrl : null,
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
      const payload: Record<string, unknown> = { publish: useEditor ? draft : "" };
      if (usePdf) payload.promoPdfUrl = promoPdfUrl;
      if (useImage) payload.promoImageUrl = promoImageUrl;
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setPromoPdfUrl(data.url);
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
      formData.append("policy", "venue");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setPromoImageUrl(data.url);
      setMessage({ type: "ok", text: "이미지가 업로드되었습니다." });
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
          <span className="text-sm font-medium">이미지 파일</span>
        </label>
      </div>
      {useEditor && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">에디터 내용</p>
          <RichEditorLazy
            value={draft}
            onChange={setDraft}
            placeholder="홍보 내용을 작성하세요"
            minHeight="320px"
          />
        </div>
      )}
      {usePdf && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">PDF 파일</p>
          <input type="file" accept="application/pdf" onChange={onPdfChange} disabled={pdfUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-site-primary/10 file:text-site-primary hover:file:bg-site-primary/20" />
          {promoPdfUrl && (
            <p className="text-sm text-gray-600">
              등록됨: <a href={promoPdfUrl} target="_blank" rel="noopener noreferrer" className="text-site-primary underline">{promoPdfUrl.slice(0, 60)}…</a>
              <button type="button" onClick={() => setPromoPdfUrl(null)} className="ml-2 text-red-600 text-xs">삭제</button>
            </p>
          )}
        </div>
      )}
      {useImage && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">대표 이미지</p>
          <input type="file" accept="image/*" onChange={onImageChange} disabled={imageUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-site-primary/10 file:text-site-primary hover:file:bg-site-primary/20" />
          {promoImageUrl && (
            <div className="flex items-center gap-3">
              <img src={promoImageUrl} alt="대표" className="h-24 w-auto object-contain rounded border border-gray-200" />
              <button type="button" onClick={() => setPromoImageUrl(null)} className="text-red-600 text-sm">삭제</button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTemplateModal("load")}
          className="px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50"
        >
          템플릿 불러오기
        </button>
        <button
          type="button"
          onClick={() => setTemplateModal("save")}
          className="px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50"
        >
          현재 페이지를 템플릿으로 저장
        </button>
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
          마지막 게시: {formatKoreanDateTime(publishedAt)}
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

      {/* 템플릿 불러오기 모달 */}
      {templateModal === "load" && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setTemplateModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">템플릿 불러오기</h2>
              <button
                type="button"
                onClick={() => setTemplateModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {templateListLoading ? (
                <p className="text-sm text-gray-500">불러오는 중...</p>
              ) : templateList.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 템플릿이 없습니다.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {templateList.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="text-left p-4 rounded-lg border border-gray-200 hover:border-site-primary hover:bg-site-primary/5 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {categoryLabel(t.category)}
                        {t.isDefault ? " · 기본 제공" : ""}
                      </p>
                      {t.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 현재 페이지를 템플릿으로 저장 모달 */}
      {templateModal === "save" && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setTemplateModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">현재 페이지를 템플릿으로 저장</h2>
            <p className="text-sm text-gray-600 mb-4">
              현재 편집 중인 내용을 템플릿으로 저장하면, 나중에 다른 페이지에서 불러와 사용할 수 있습니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 *</label>
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="예: 우리 당구장 소개"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">용도 설명</label>
                <input
                  type="text"
                  value={saveTemplateDesc}
                  onChange={(e) => setSaveTemplateDesc(e.target.value)}
                  placeholder="예: 당구장 소개형"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={saveTemplateCategory}
                  onChange={(e) => setSaveTemplateCategory(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {PROMO_TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTemplateModal(null)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={saveTemplateSubmitting}
                className="px-3 py-1.5 rounded bg-site-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saveTemplateSubmitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
