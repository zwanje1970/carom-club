"use client";

import { useState, useRef } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_EXT = "jpg, jpeg, png, webp";

type Props = {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  /** 업로드 시 사용할 정책 (`/api/admin/upload-image`와 동일) */
  policy?: "content" | "section" | "banner" | "logo" | "thumbnail" | "venue" | "tournament";
  recommendedSize?: string;
  required?: boolean;
};

export function AdminImageField({
  label,
  value,
  onChange,
  policy = "section",
  recommendedSize,
  required = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file?.size) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("policy", policy);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "업로드에 실패했습니다.");
      }
      if (data.url) onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-site-text">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {recommendedSize && (
        <p className="text-xs text-gray-500">권장 크기: {recommendedSize}</p>
      )}

      {value ? (
        <div className="rounded-lg border border-site-border bg-gray-50 p-3 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-start gap-3">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="rounded border border-site-border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading ? "업로드 중…" : "첨부파일 교체"}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            rounded-lg border-2 border-dashed p-6 text-center text-sm
            ${dragOver ? "border-site-primary bg-site-primary/5" : "border-site-border"}
          `}
        >
          <p className="text-gray-600 dark:text-slate-400">
            드래그 앤 드롭 또는 첨부파일 선택 (허용: {ALLOWED_EXT})
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="mt-2 hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="mt-2 rounded border border-site-border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "업로드 중…" : "첨부파일 선택"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
