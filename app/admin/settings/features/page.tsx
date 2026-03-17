"use client";

import { useState, useEffect } from "react";
import { mdiToggleSwitch } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type Item = { key: string; label: string; enabled: boolean };

export default function AdminSettingsFeaturesPage() {
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
      <SectionTitleLineWithButton icon={mdiToggleSwitch} title="기능 관리" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        서버 점검 또는 운영 상황에 따라 기능을 즉시 ON/OFF 할 수 있습니다.
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
              <li key={item.key} className="flex items-center justify-between py-4">
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
