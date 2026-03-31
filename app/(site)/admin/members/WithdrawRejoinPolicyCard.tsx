"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type SiteSettingsResponse = {
  withdrawRejoinDays?: number;
  error?: string;
};

export function WithdrawRejoinPolicyCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: SiteSettingsResponse) => {
        setDays(Math.max(0, Math.floor(Number(data.withdrawRejoinDays)) || 0));
      })
      .catch(() => {
        setError("재가입 정책을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const nextDays = Math.max(0, Math.floor(Number(days)) || 0);
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawRejoinDays: nextDays }),
      });
      const data = (await res.json().catch(() => ({}))) as SiteSettingsResponse;
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setDays(Math.max(0, Math.floor(Number(data.withdrawRejoinDays)) || nextDays));
      setSuccess("저장되었습니다.");
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardBox>
      <h3 className="text-base font-semibold text-site-text">가입 · 회원 (전역)</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
        회원탈퇴 후 재가입 가능 기간(일)을 설정합니다. 0이면 즉시 재가입 가능합니다.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">불러오는 중…</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-site-text-muted">재가입 가능 기간 (일)</span>
            <input
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-28 rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
      {error ? (
        <div className="mt-3">
          <NotificationBar color="danger">{error}</NotificationBar>
        </div>
      ) : null}
      {success ? (
        <div className="mt-3">
          <NotificationBar color="success">{success}</NotificationBar>
        </div>
      ) : null}
    </CardBox>
  );
}
