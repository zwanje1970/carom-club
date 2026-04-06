"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

type IntroSettings = {
  enabled: boolean;
  title: string;
  description: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  linkUrl: string | null;
  displaySeconds: number;
  showSkipButton: boolean;
};

export default function AdminSiteIntroPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<IntroSettings>({
    enabled: false,
    title: "",
    description: "",
    mediaType: "image",
    mediaUrl: "",
    linkUrl: null,
    displaySeconds: 4,
    showSkipButton: true,
  });

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) =>
        setForm({
          enabled: Boolean(data?.introSettings?.enabled),
          title: String(data?.introSettings?.title ?? ""),
          description: String(data?.introSettings?.description ?? ""),
          mediaType: data?.introSettings?.mediaType === "video" ? "video" : "image",
          mediaUrl: String(data?.introSettings?.mediaUrl ?? ""),
          linkUrl: typeof data?.introSettings?.linkUrl === "string" ? data.introSettings.linkUrl : null,
          displaySeconds: Math.max(1, Math.min(30, Number(data?.introSettings?.displaySeconds) || 4)),
          showSkipButton: data?.introSettings?.showSkipButton !== false,
        })
      )
      .catch(() =>
        setForm({
          enabled: false,
          title: "",
          description: "",
          mediaType: "image",
          mediaUrl: "",
          linkUrl: null,
          displaySeconds: 4,
          showSkipButton: true,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2200);
    return () => clearTimeout(t);
  }, [success]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          introSettings: {
            enabled: Boolean(form.enabled),
            title: form.title,
            description: form.description,
            mediaType: form.mediaType,
            mediaUrl: form.mediaUrl,
            linkUrl: form.linkUrl,
            displaySeconds: form.displaySeconds,
            showSkipButton: Boolean(form.showSkipButton),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setSuccess("저장 완료");
    } catch (e) {
      setError(e instanceof Error ? "저장 실패" : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">인트로 설정</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          인트로 화면의 표시 여부를 설정합니다.
        </p>
      </CardBox>
      <CardBox className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-site-text">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              인트로 사용
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button label={saving ? "저장 중..." : "저장"} color="info" disabled={saving} onClick={() => void save()} />
              {saving ? <span className="text-xs text-gray-600 dark:text-slate-400">저장 중...</span> : null}
              {!saving && success ? <span className="text-xs text-green-700 dark:text-green-300">{success}</span> : null}
              {!saving && error ? <span className="text-xs text-red-600 dark:text-red-300">{error}</span> : null}
              <Button href="/admin/site" label="취소" color="contrast" outline />
            </div>
          </>
        )}
      </CardBox>
    </div>
  );
}
