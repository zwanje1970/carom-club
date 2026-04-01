"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCopyValue } from "@/lib/admin-copy";

type Props = {
  copy: Record<string, string>;
  feedbackType: "FEATURE" | "BUG";
};

export function ClientFeedbackForm({ copy, feedbackType }: Props) {
  const isBug = feedbackType === "BUG";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isBug && typeof window !== "undefined") {
      setPagePath(window.location.pathname || "/client/operations");
    }
  }, [isBug]);

  const pageTitle = useMemo(
    () =>
      getCopyValue(
        copy,
        feedbackType === "BUG" ? "client.feedback.bug.title" : "client.feedback.feature.title"
      ),
    [copy, feedbackType]
  );

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/community/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "이미지 업로드에 실패했습니다.");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          title,
          content,
          imageUrl: imageUrl.trim() || null,
          pagePath: isBug ? pagePath.trim() || null : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "제출에 실패했습니다.");
        return;
      }
      setSuccess(true);
      setTitle("");
      setContent("");
      setImageUrl("");
      if (isBug && typeof window !== "undefined") {
        setPagePath(window.location.pathname || "/client/operations");
      } else {
        setPagePath("");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{pageTitle}</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {getCopyValue(copy, "client.feedback.field.title")}
          </span>
          <input
            required
            value={title}
            maxLength={120}
            onChange={(evt) => setTitle(evt.target.value)}
            placeholder={getCopyValue(copy, "client.feedback.placeholder.title")}
            className="min-h-[44px] w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {getCopyValue(copy, "client.feedback.field.content")}
          </span>
          <textarea
            required
            value={content}
            maxLength={5000}
            onChange={(evt) => setContent(evt.target.value)}
            placeholder={getCopyValue(copy, "client.feedback.placeholder.content")}
            className="min-h-[160px] w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {getCopyValue(copy, "client.feedback.field.image")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={imageUrl}
              onChange={(evt) => setImageUrl(evt.target.value)}
              placeholder={getCopyValue(copy, "client.feedback.placeholder.imageUrl")}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            />
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md border border-zinc-300 px-3 text-xs font-medium dark:border-zinc-600">
              {uploading ? getCopyValue(copy, "client.feedback.uploading") : getCopyValue(copy, "client.feedback.upload")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(evt) => {
                  const f = evt.target.files?.[0];
                  if (f) void onUpload(f);
                  evt.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </label>

        {isBug && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              {getCopyValue(copy, "client.feedback.field.pagePath")}
            </span>
            <input
              value={pagePath}
              onChange={(evt) => setPagePath(evt.target.value)}
              placeholder={getCopyValue(copy, "client.feedback.placeholder.pagePath")}
              className="min-h-[44px] w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
        )}

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {getCopyValue(copy, "client.feedback.success")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || uploading}
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-4 text-xs font-semibold text-white disabled:opacity-50 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? getCopyValue(copy, "client.feedback.submitting") : getCopyValue(copy, "client.feedback.submit")}
          </button>
          <Link
            href="/client/operations"
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-xs font-medium dark:border-zinc-600"
          >
            {getCopyValue(copy, "client.feedback.backToOperations")}
          </Link>
        </div>
      </form>
    </div>
  );
}
