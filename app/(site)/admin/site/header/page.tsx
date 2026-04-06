"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminColorField } from "@/components/admin/_components/AdminColorField";

type HeaderSettings = {
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
};

const DEFAULT_HEADER: HeaderSettings = {
  headerBgColor: null,
  headerTextColor: null,
  headerActiveColor: null,
};

export default function AdminSiteHeaderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<HeaderSettings>(DEFAULT_HEADER);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) =>
        setForm({
          headerBgColor: data?.headerBgColor ?? null,
          headerTextColor: data?.headerTextColor ?? null,
          headerActiveColor: data?.headerActiveColor ?? null,
        })
      )
      .catch(() => setForm(DEFAULT_HEADER))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headerBgColor: form.headerBgColor?.trim() || null,
          headerTextColor: form.headerTextColor?.trim() || null,
          headerActiveColor: form.headerActiveColor?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      setSuccess("저장되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">헤더 관리</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          헤더 배경, 메뉴 글자, 활성 메뉴 색상을 설정합니다.
        </p>
      </CardBox>
      <CardBox className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <AdminColorField
                label="헤더 배경"
                value={form.headerBgColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerBgColor: hex }))}
                nullable
              />
              <AdminColorField
                label="메뉴 글자"
                value={form.headerTextColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerTextColor: hex }))}
                nullable
              />
              <AdminColorField
                label="활성 메뉴"
                value={form.headerActiveColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerActiveColor: hex }))}
                nullable
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button label={saving ? "저장 중..." : "저장"} color="info" disabled={saving} onClick={() => void save()} />
              <Button href="/admin/site" label="취소" color="contrast" outline />
              {error ? <NotificationBar color="danger">{error}</NotificationBar> : null}
              {success ? <NotificationBar color="success">{success}</NotificationBar> : null}
            </div>
          </>
        )}
      </CardBox>
    </div>
  );
}
