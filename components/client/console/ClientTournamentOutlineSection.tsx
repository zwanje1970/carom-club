"use client";

import { useMemo, useState } from "react";
import { RichEditorLazy } from "@/components/RichEditorLazy";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import {
  defaultOutlineTemplateName,
  listOutlineTemplates,
  saveOutlineTemplate,
  type OutlineDisplayMode,
} from "@/lib/client-outline-templates";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextMuted } from "@/components/client/console/ui/tokens";

const MODE_OPTIONS: { value: OutlineDisplayMode; label: string; hint: string }[] = [
  { value: "direct", label: "직접입력", hint: "에디터에 바로 작성합니다." },
  { value: "load", label: "불러오기(수정가능)", hint: "저장된 요강을 복사해 이 대회에서만 수정합니다." },
  { value: "image", label: "이미지첨부로 보여주기", hint: "이미지 한 장을 등록해 표시합니다." },
  { value: "pdf", label: "PDF로 보여주기", hint: "PDF 파일을 올려 링크로 안내합니다." },
];

function wrapImagePromo(url: string): string {
  return `<p class="outline-image-wrap"><img src="${url}" alt="경기요강" /></p>`;
}

function extractImgSrc(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() || null;
}

type Props = {
  organizationId: string;
  outlineDisplayMode: OutlineDisplayMode;
  setOutlineDisplayMode: (m: OutlineDisplayMode) => void;
  promoContent: string;
  setPromoContent: (v: string) => void;
  outlinePdfUrl: string;
  setOutlinePdfUrl: (v: string) => void;
  outlineImageUrl: string;
  setOutlineImageUrl: (v: string) => void;
};

export function ClientTournamentOutlineSection({
  organizationId,
  outlineDisplayMode,
  setOutlineDisplayMode,
  promoContent,
  setPromoContent,
  outlinePdfUrl,
  setOutlinePdfUrl,
  outlineImageUrl,
  setOutlineImageUrl,
}: Props) {
  const [templateName, setTemplateName] = useState(defaultOutlineTemplateName);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);
  const [loadId, setLoadId] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const templates = useMemo(() => listOutlineTemplates(organizationId), [organizationId]);

  function applyMode(next: OutlineDisplayMode) {
    setOutlineDisplayMode(next);
    if (next !== "pdf") setPdfError(null);
    if (next === "direct" && !promoContent.trim()) setPromoContent("");
    if (next === "image" && outlineImageUrl) {
      setPromoContent(wrapImagePromo(outlineImageUrl));
    }
    if (next === "pdf") {
      setPromoContent(promoContent.trim() ? promoContent : "<p>PDF로 안내합니다.</p>");
    }
  }

  function handleLoadTemplate() {
    const t = templates.find((x) => x.id === loadId);
    if (!t) return;
    const copyPromo = t.promoContent ?? "";
    const copyImg = t.outlineImageUrl ?? null;
    const copyPdf = t.outlinePdfUrl ?? null;
    if (t.mode === "image" && copyImg) {
      setOutlineDisplayMode("image");
      setOutlineImageUrl(copyImg);
      setPromoContent(wrapImagePromo(copyImg));
      setOutlinePdfUrl("");
    } else if (t.mode === "pdf" && copyPdf) {
      setOutlineDisplayMode("pdf");
      setOutlinePdfUrl(copyPdf);
      setPromoContent("<p>PDF로 안내합니다.</p>");
      setOutlineImageUrl("");
    } else {
      setOutlineDisplayMode("load");
      setPromoContent(copyPromo);
      setOutlineImageUrl("");
      setOutlinePdfUrl("");
    }
    setTemplateMsg("복사본이 편집 영역에 불러와졌습니다. 원본 템플릿은 그대로 유지됩니다.");
  }

  function handleSaveTemplateOnly() {
    setTemplateMsg(null);
    const nameInput = templateName.trim() || defaultOutlineTemplateName();
    let mode: "direct" | "image" | "pdf" = "direct";
    if (outlineDisplayMode === "image") mode = "image";
    else if (outlineDisplayMode === "pdf") mode = "pdf";
    else mode = "direct";

    const rec = saveOutlineTemplate(
      organizationId,
      {
        mode,
        promoContent: promoContent.trim() || null,
        outlineImageUrl: outlineDisplayMode === "image" ? outlineImageUrl || extractImgSrc(promoContent) : null,
        outlinePdfUrl: outlineDisplayMode === "pdf" ? outlinePdfUrl || null : null,
      },
      nameInput
    );
    setTemplateMsg(`「${rec.name}」으로 경기요강만 저장했습니다.`);
  }

  async function handlePdfFile(file: File | null) {
    if (!file?.size) return;
    setPdfError(null);
    setPdfUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/client/upload-outline-pdf", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "업로드 실패");
      const url = (data as { url?: string }).url;
      if (url) {
        setOutlinePdfUrl(url);
        setPromoContent("<p>PDF로 안내합니다.</p>");
      }
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setPdfUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className={cx(consoleTextMuted, "text-[11px]")}>
        아래 저장은 <strong className="text-zinc-800 dark:text-zinc-100">경기요강만</strong> 저장합니다. 대회 전체 반영은 하단{" "}
        <strong className="text-zinc-800 dark:text-zinc-100">대회 저장</strong> 버튼을 눌러 주세요.
      </p>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">경기요강 표시 방식</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => applyMode(opt.value)}
              className={cx(
                "rounded-sm border px-3 py-2 text-left text-xs transition",
                outlineDisplayMode === opt.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="mt-0.5 block text-[11px] opacity-90">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {outlineDisplayMode === "direct" ? (
        <div className="space-y-2">
          <RichEditorLazy value={promoContent} onChange={setPromoContent} placeholder="경기 요강·안내 문구를 입력하세요" minHeight="200px" />
        </div>
      ) : null}

      {outlineDisplayMode === "load" ? (
        <div className="space-y-3 rounded-sm border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-800/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-medium text-zinc-700 dark:text-zinc-300">저장된 경기요강</label>
              <select
                className="w-full rounded-sm border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={loadId}
                onChange={(e) => setLoadId(e.target.value)}
              >
                <option value="">선택…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.mode === "direct" ? "직접" : t.mode === "image" ? "이미지" : "PDF"})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!loadId}
              onClick={handleLoadTemplate}
              className="inline-flex min-h-[40px] items-center rounded-sm border border-zinc-800 bg-zinc-800 px-3 text-xs font-semibold text-white disabled:opacity-50 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
            >
              불러오기
            </button>
          </div>
          {templateMsg ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{templateMsg}</p> : null}
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            불러온 내용은 이 대회용 복사본입니다. 아래에서 수정해도 목록에 있는 원본은 바뀌지 않습니다.
          </p>
          <RichEditorLazy value={promoContent} onChange={setPromoContent} placeholder="불러온 뒤 이 대회에 맞게 수정하세요" minHeight="200px" />
        </div>
      ) : null}

      {outlineDisplayMode === "image" ? (
        <div className="space-y-2">
          <AdminImageField
            label="경기요강 이미지"
            value={outlineImageUrl || extractImgSrc(promoContent)}
            onChange={(url) => {
              setOutlineImageUrl(url ?? "");
              if (url) setPromoContent(wrapImagePromo(url));
              else setPromoContent("");
            }}
            policy="tournament"
            recommendedSize="가로 1200px 이상 권장"
          />
        </div>
      ) : null}

      {outlineDisplayMode === "pdf" ? (
        <div className="space-y-2 rounded-sm border border-zinc-200 p-3 dark:border-zinc-600">
          <label className="block text-xs font-medium text-zinc-800 dark:text-zinc-100">PDF 파일</label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-xs"
            disabled={pdfUploading}
            onChange={(e) => void handlePdfFile(e.target.files?.[0] ?? null)}
          />
          {pdfUploading ? <p className="text-xs text-zinc-500">업로드 중…</p> : null}
          {pdfError ? <p className="text-xs text-red-600">{pdfError}</p> : null}
          {outlinePdfUrl ? (
            <p className="break-all text-xs text-zinc-700 dark:text-zinc-300">
              연결됨:{" "}
              <a href={outlinePdfUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline dark:text-indigo-300">
                PDF 열기
              </a>
            </p>
          ) : (
            null
          )}
        </div>
      ) : null}

      <div className="rounded-sm border border-dashed border-zinc-300 p-3 dark:border-zinc-600">
        <p className="mb-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">경기요강만 저장 (목록에 템플릿 추가)</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            className="w-full rounded-sm border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 sm:max-w-xs"
            placeholder={defaultOutlineTemplateName()}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSaveTemplateOnly}
            className="inline-flex min-h-[40px] items-center rounded-sm border border-amber-700 bg-amber-50 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
          >
            경기요강만 저장
          </button>
        </div>
        {templateMsg ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{templateMsg}</p> : null}
      </div>
    </div>
  );
}
