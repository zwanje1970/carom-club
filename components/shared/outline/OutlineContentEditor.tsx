"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import type { OutlineDisplayMode } from "../../../lib/outline-content-types";

const OutlineRichEditor = dynamic(() => import("./OutlineRichEditor"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "0.4rem",
        minHeight: "12rem",
        background: "#f8fafc",
        padding: "0.75rem",
        fontSize: "0.85rem",
        color: "#64748b",
      }}
    >
      편집기를 불러오는 중…
    </div>
  ),
});

export type OutlineContentEditorProps = {
  /** 섹션 제목 (예: 경기요강, 당구장 소개) */
  heading: string;
  displayMode: OutlineDisplayMode;
  onDisplayModeChange: (mode: OutlineDisplayMode) => void;
  outlineHtml: string;
  onOutlineHtmlChange: (html: string) => void;
  outlineImageUrl: string;
  onOutlineImageUrlChange: (url: string) => void;
  outlinePdfUrl: string;
  onOutlinePdfUrlChange: (url: string) => void;
  /** 모바일·좁은 화면에서 단순 UI */
  compact?: boolean;
  imageUploadError?: string;
  pdfUploadError?: string;
};

export default function OutlineContentEditor({
  heading,
  displayMode,
  onDisplayModeChange,
  outlineHtml,
  onOutlineHtmlChange,
  outlineImageUrl,
  onOutlineImageUrlChange,
  outlinePdfUrl,
  onOutlinePdfUrlChange,
  compact,
  imageUploadError: imageUploadErrorProp,
  pdfUploadError: pdfUploadErrorProp,
}: OutlineContentEditorProps) {
  const fieldId = useId();
  const [imageBusy, setImageBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [imageErr, setImageErr] = useState("");
  const [pdfErr, setPdfErr] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const imageUploadError = imageUploadErrorProp ?? imageErr;
  const pdfUploadError = pdfUploadErrorProp ?? pdfErr;

  async function onOutlineImageFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setImageErr("");
    setImageBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; w640Url?: string };
      if (!res.ok) {
        setImageErr(data.error ?? "이미지 업로드에 실패했습니다.");
        return;
      }
      if (typeof data.w640Url === "string" && data.w640Url) {
        onOutlineImageUrlChange(data.w640Url);
      }
    } catch {
      setImageErr("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function onOutlinePdfFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setPdfErr("");
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/client/upload-outline-pdf", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) {
        setPdfErr(data.error ?? "PDF 업로드에 실패했습니다.");
        return;
      }
      if (typeof data.url === "string" && data.url) {
        onOutlinePdfUrlChange(data.url);
      }
    } catch {
      setPdfErr("PDF 업로드 중 오류가 발생했습니다.");
    } finally {
      setPdfBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  const modeRowStyle = compact
    ? { flexDirection: "column" as const, alignItems: "stretch" as const }
    : {};

  return (
    <div className="v3-stack" style={{ gap: compact ? "0.65rem" : "0.85rem" }}>
      <div className="v3-row" style={{ ...modeRowStyle, gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="v3-muted" style={{ fontSize: compact ? "0.8rem" : "0.85rem", marginRight: compact ? 0 : "0.25rem" }}>
          표시 방식
        </span>
        {(
          [
            { v: "TEXT" as const, label: "직접입력" },
            { v: "IMAGE" as const, label: "이미지" },
            { v: "PDF" as const, label: "PDF" },
          ] as const
        ).map(({ v, label }) => (
          <label
            key={v}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: compact ? "0.85rem" : "0.9rem",
              cursor: "pointer",
            }}
          >
            <input type="radio" name={`outline-mode-${fieldId}`} checked={displayMode === v} onChange={() => onDisplayModeChange(v)} />
            {label}
          </label>
        ))}
      </div>

      {displayMode === "TEXT" ? (
        <OutlineRichEditor
          value={outlineHtml}
          onChange={onOutlineHtmlChange}
          placeholder={`${heading} 내용을 입력하세요.`}
          compact={compact}
        />
      ) : null}

      {displayMode === "IMAGE" ? (
        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onOutlineImageFile(e.target.files)} />
            <button
              type="button"
              className="v3-btn"
              disabled={imageBusy}
              onClick={() => imageInputRef.current?.click()}
            >
              {imageBusy ? "업로드 중…" : "이미지 선택"}
            </button>
            {outlineImageUrl ? (
              <button type="button" className="v3-btn" onClick={() => onOutlineImageUrlChange("")}>
                이미지 제거
              </button>
            ) : null}
          </div>
          {imageUploadError ? <p className="v3-muted">{imageUploadError}</p> : null}
          {outlineImageUrl ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.5rem", background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outlineImageUrl} alt="" style={{ maxWidth: "100%", height: "auto", display: "block" }} />
            </div>
          ) : (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              이미지를 올리면 저장 시 함께 연결됩니다. 직접입력 내용은 삭제되지 않습니다.
            </p>
          )}
        </div>
      ) : null}

      {displayMode === "PDF" ? (
        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <input ref={pdfInputRef} type="file" accept="application/pdf" hidden onChange={(e) => onOutlinePdfFile(e.target.files)} />
            <button type="button" className="v3-btn" disabled={pdfBusy} onClick={() => pdfInputRef.current?.click()}>
              {pdfBusy ? "업로드 중…" : "PDF 선택"}
            </button>
            {outlinePdfUrl ? (
              <button type="button" className="v3-btn" onClick={() => onOutlinePdfUrlChange("")}>
                PDF 제거
              </button>
            ) : null}
          </div>
          {pdfUploadError ? <p className="v3-muted">{pdfUploadError}</p> : null}
          {outlinePdfUrl ? (
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <a href={outlinePdfUrl} target="_blank" rel="noopener noreferrer">
                요강 보기
              </a>
            </p>
          ) : (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              PDF를 올리면 저장 시 함께 연결됩니다. 직접입력 내용은 그대로 유지됩니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
