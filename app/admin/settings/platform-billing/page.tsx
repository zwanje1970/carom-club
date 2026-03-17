"use client";

import { useState, useEffect } from "react";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type PlatformBillingSettings = {
  billingEnabled: boolean;
  tournamentFee: number;
  clientMembershipFee: number;
};

const DEFAULT_SETTINGS: PlatformBillingSettings = {
  billingEnabled: false,
  tournamentFee: 30000,
  clientMembershipFee: 180000,
};

export default function AdminSettingsPlatformBillingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<PlatformBillingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((res) => {
        if (!res.ok) throw new Error("불러오기 실패");
        return res.json();
      })
      .then((data: PlatformBillingSettings & { updatedAt?: string }) => {
        setForm({
          billingEnabled: data.billingEnabled ?? false,
          tournamentFee: typeof data.tournamentFee === "number" ? data.tournamentFee : 30000,
          clientMembershipFee: typeof data.clientMembershipFee === "number" ? data.clientMembershipFee : 180000,
        });
      })
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingEnabled: form.billingEnabled,
          tournamentFee: form.tournamentFee,
          clientMembershipFee: form.clientMembershipFee,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "저장에 실패했습니다.");
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
        <SectionTitleLineWithButton icon={mdiCog} title="요금 정책" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title="요금 정책" />
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        요금 정책 활성화 여부와 대회 1회 이용권·클라이언트 당구장 연회원 가격을 설정합니다. 비활성화 시 모든 기능이 무료로 제공됩니다.
      </p>
      <CardBox className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-site-border bg-site-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-site-text">요금 정책 활성화</h2>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-sm text-site-text">
                결제 시스템 활성화 (2027년~)
              </span>
              <input
                type="checkbox"
                checked={form.billingEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billingEnabled: e.target.checked }))
                }
                className="h-4 w-4 rounded border-site-border text-site-primary focus:ring-site-primary"
              />
            </label>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              꺼짐: 모든 기능 무료 (2026년). 켜짐: 일반 당구장은 대회 1회 이용권 결제, 클라이언트 당구장 연회원은 결제 없이 대회 생성 가능.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-site-text mb-1">
              대회 1회 이용권 가격 (원)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.tournamentFee}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tournamentFee: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="w-full rounded-lg border border-site-border bg-white px-3 py-2.5 text-site-text"
            />
            <p className="mt-1 text-xs text-gray-500">
              일반 당구장이 대회 운영 기능(홍보·참가자 관리·대진표·정산) 사용 시 1회당 결제 금액.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-site-text mb-1">
              클라이언트 당구장 연회원 가격 (원)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.clientMembershipFee}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clientMembershipFee: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="w-full rounded-lg border border-site-border bg-white px-3 py-2.5 text-site-text"
            />
            <p className="mt-1 text-xs text-gray-500">
              연회원 결제 시 해당 당구장은 대회 무제한 생성 및 모든 대회 기능 사용 가능.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              label={saving ? "저장 중…" : "저장"}
              color="info"
              disabled={saving}
            />
            <Button href="/admin/settings" label="취소" color="contrast" outline />
            {error && <NotificationBar color="danger">{error}</NotificationBar>}
            {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
          </div>
        </form>
      </CardBox>
    </SectionMain>
  );
}
