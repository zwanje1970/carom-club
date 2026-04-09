"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { AdminColorField } from "@/components/admin/_components/AdminColorField";

type MobileHeaderSettings = {
  mobileHeaderBgColor: string | null;
  mobileHeaderTextColor: string | null;
  mobileHeaderActiveColor: string | null;
  mobileHeaderLogoText: string | null;
};

const DEFAULT_MOBILE_HEADER: MobileHeaderSettings = {
  mobileHeaderBgColor: null,
  mobileHeaderTextColor: null,
  mobileHeaderActiveColor: null,
  mobileHeaderLogoText: null,
};

export default function AdminSiteMobileHeaderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<MobileHeaderSettings>(DEFAULT_MOBILE_HEADER);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) =>
        setForm({
          mobileHeaderBgColor: data?.mobileHeaderBgColor ?? null,
          mobileHeaderTextColor: data?.mobileHeaderTextColor ?? null,
          mobileHeaderActiveColor: data?.mobileHeaderActiveColor ?? null,
          mobileHeaderLogoText: data?.mobileHeaderLogoText ?? null,
        })
      )
      .catch(() => setForm(DEFAULT_MOBILE_HEADER))
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
          mobileHeaderBgColor: form.mobileHeaderBgColor?.trim() || null,
          mobileHeaderTextColor: form.mobileHeaderTextColor?.trim() || null,
          mobileHeaderActiveColor: form.mobileHeaderActiveColor?.trim() || null,
          mobileHeaderLogoText: form.mobileHeaderLogoText?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setSuccess("저장 완료");
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">모바일 헤더 관리</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          모바일 헤더 배경, 텍스트, 활성 색상과 텍스트 로고 문구를 설정합니다.
        </p>
      </CardBox>
      <CardBox className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <AdminColorField
                label="모바일 헤더 배경"
                value={form.mobileHeaderBgColor}
                onChange={(hex) => setForm((f) => ({ ...f, mobileHeaderBgColor: hex }))}
                nullable
              />
              <AdminColorField
                label="모바일 헤더 텍스트"
                value={form.mobileHeaderTextColor}
                onChange={(hex) => setForm((f) => ({ ...f, mobileHeaderTextColor: hex }))}
                nullable
              />
              <AdminColorField
                label="모바일 헤더 활성색"
                value={form.mobileHeaderActiveColor}
                onChange={(hex) => setForm((f) => ({ ...f, mobileHeaderActiveColor: hex }))}
                nullable
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-site-text">모바일 텍스트 로고 문구</label>
              <input
                type="text"
                value={form.mobileHeaderLogoText ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, mobileHeaderLogoText: e.target.value }))}
                placeholder="예: CAROM.CLUB"
                className="w-full rounded-lg border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                비워두면 기존 기본 문구를 사용합니다.
              </p>
            </div>
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

