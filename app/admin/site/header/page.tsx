"use client";

import { useState, useEffect } from "react";
import { mdiPageLayoutHeader } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { ColorPalette64 } from "@/components/editor/ColorPalette64";

const DEFAULT_HEADER_BG = "#0a0a0a";
const DEFAULT_HEADER_TEXT = "#d1d5db";
const DEFAULT_HEADER_ACTIVE = "#fbbf24";

type HeaderForm = {
  headerBgColor: string;
  headerTextColor: string;
  headerActiveColor: string;
};

export default function AdminSiteHeaderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<HeaderForm>({
    headerBgColor: DEFAULT_HEADER_BG,
    headerTextColor: DEFAULT_HEADER_TEXT,
    headerActiveColor: DEFAULT_HEADER_ACTIVE,
  });

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) => {
        setForm({
          headerBgColor: data.headerBgColor?.trim() || DEFAULT_HEADER_BG,
          headerTextColor: data.headerTextColor?.trim() || DEFAULT_HEADER_TEXT,
          headerActiveColor: data.headerActiveColor?.trim() || DEFAULT_HEADER_ACTIVE,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headerBgColor: form.headerBgColor || null,
          headerTextColor: form.headerTextColor || null,
          headerActiveColor: form.headerActiveColor || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장에 실패했습니다.");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiPageLayoutHeader} title="헤더 설정" />
        <CardBox><p className="text-gray-500">불러오는 중…</p></CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiPageLayoutHeader} title="헤더 설정" />
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        상단 헤더 배경색·글자색·활성 메뉴 강조색을 설정합니다. 메인페이지와 모든 페이지에 적용됩니다.
      </p>
      <CardBox className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">헤더 배경색</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={form.headerBgColor}
                onChange={(e) => setForm((f) => ({ ...f, headerBgColor: e.target.value }))}
                className="w-28 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
              />
              <ColorPalette64
                applyMode="background"
                selectedHex={form.headerBgColor}
                onSelect={(hex) => setForm((f) => ({ ...f, headerBgColor: hex }))}
                cellSize={20}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-site-text mb-1">헤더 글자색</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={form.headerTextColor}
                onChange={(e) => setForm((f) => ({ ...f, headerTextColor: e.target.value }))}
                className="w-28 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
              />
              <ColorPalette64
                applyMode="text"
                selectedHex={form.headerTextColor}
                onSelect={(hex) => setForm((f) => ({ ...f, headerTextColor: hex }))}
                cellSize={20}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-site-text mb-1">활성 메뉴 강조색</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={form.headerActiveColor}
                onChange={(e) => setForm((f) => ({ ...f, headerActiveColor: e.target.value }))}
                className="w-28 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
              />
              <ColorPalette64
                applyMode="text"
                selectedHex={form.headerActiveColor}
                onSelect={(hex) => setForm((f) => ({ ...f, headerActiveColor: hex }))}
                cellSize={20}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
            <Button href="/admin/site" label="취소" color="contrast" outline />
            {error && <NotificationBar color="danger">{error}</NotificationBar>}
            {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
          </div>
        </form>
      </CardBox>

      <div className="mt-6 rounded-lg border border-site-border bg-site-card p-4">
        <p className="text-sm font-medium text-site-text mb-2">미리보기</p>
        <div
          className="h-12 rounded flex items-center px-4 text-sm"
          style={{
            backgroundColor: form.headerBgColor,
            color: form.headerTextColor,
          }}
        >
          <span style={{ color: form.headerActiveColor }}>HOME</span>
          <span className="mx-4 opacity-80">당구장</span>
          <span className="opacity-80">대회</span>
          <span className="ml-4 opacity-80">커뮤니티</span>
        </div>
      </div>
    </SectionMain>
  );
}
