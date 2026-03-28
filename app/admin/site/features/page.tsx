"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { mdiToggleSwitch } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type Item = { key: string; label: string; enabled: boolean };

export default function AdminSiteFeaturesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-feature-flags")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/site-feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "저장 실패");
        return;
      }
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, enabled } : i)));
      setSuccess("저장되었습니다.");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site" className="text-site-primary hover:underline">
          ← 사이트관리 홈
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiToggleSwitch} title="기능 설정" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        가입·대회·커뮤니티 등 <strong>기능 단위 스위치</strong>입니다. 문구나 색상은「문구 관리」「디자인/브랜드 설정」에서
        바꿉니다. 운영/점검 시 즉시 ON/OFF 할 수 있습니다.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {error && <NotificationBar color="danger">{error}</NotificationBar>}
              {success && <NotificationBar color="success">{success}</NotificationBar>}
            </div>
            <ul className="divide-y divide-site-border">
              {items.map((item) => (
                <li key={item.key} className="flex items-center justify-between py-4 gap-4">
                  <span className="font-medium text-site-text">{item.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    onClick={() => toggle(item.key, !item.enabled)}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2 disabled:opacity-50 ${
                      item.enabled ? "bg-site-primary" : "bg-gray-200 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                        item.enabled ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBox>
    </SectionMain>
  );
}
