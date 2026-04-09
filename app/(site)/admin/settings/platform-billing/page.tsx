"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [annualMembershipVisible, setAnnualMembershipVisible] = useState(false);
  const [annualMembershipEnforced, setAnnualMembershipEnforced] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/platform-settings").then((res) => {
        if (!res.ok) throw new Error("불러오기 실패");
        return res.json();
      }),
      fetch("/api/admin/site-feature-flags")
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .catch(() => ({ items: [] })),
    ])
      .then(([platform, flags]: [PlatformBillingSettings, { items?: Array<{ key: string; enabled: boolean }> }]) => {
        setForm({
          billingEnabled: platform.billingEnabled ?? false,
          tournamentFee: typeof platform.tournamentFee === "number" ? platform.tournamentFee : 30000,
          clientMembershipFee:
            typeof platform.clientMembershipFee === "number" ? platform.clientMembershipFee : 180000,
        });
        const items = Array.isArray(flags?.items) ? flags.items : [];
        const visible = items.find((item) => item.key === "annual_membership_visible");
        const enforced = items.find((item) => item.key === "annual_membership_enforced");
        setAnnualMembershipVisible(Boolean(visible?.enabled));
        setAnnualMembershipEnforced(Boolean(enforced?.enabled));
      })
      .catch(() => {
        setForm(DEFAULT_SETTINGS);
        setAnnualMembershipVisible(false);
        setAnnualMembershipEnforced(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const billingRes = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingEnabled: form.billingEnabled,
          tournamentFee: form.tournamentFee,
          clientMembershipFee: form.clientMembershipFee,
        }),
      });
      if (!billingRes.ok) {
        const d = await billingRes.json().catch(() => ({}));
        throw new Error(d.error || "저장에 실패했습니다.");
      }

      const flagsRes = await fetch("/api/admin/site-feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annual_membership_visible: annualMembershipVisible,
          annual_membership_enforced: annualMembershipEnforced,
        }),
      });
      if (!flagsRes.ok) {
        const d = await flagsRes.json().catch(() => ({}));
        throw new Error(d.error || "연회원 설정 저장에 실패했습니다.");
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
        <SectionTitleLineWithButton icon={mdiCog} title="연회원 설정" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/platform" className="text-site-primary hover:underline">
          ← 플랫폼 대시보드
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiCog} title="연회원 설정" />
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        연회원 설정과 요금 정책을 한 화면에서 관리합니다.
      </p>
      <CardBox className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-site-border bg-site-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-site-text">연회원 설정</h2>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-site-text">연회원 노출 ON/OFF</span>
              <button
                type="button"
                role="switch"
                aria-checked={annualMembershipVisible}
                onClick={() => setAnnualMembershipVisible((prev) => !prev)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2 disabled:opacity-50 ${
                  annualMembershipVisible ? "bg-site-primary" : "bg-gray-200 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                    annualMembershipVisible ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-site-text">연회원 기능 제한 ON/OFF</span>
              <button
                type="button"
                role="switch"
                aria-checked={annualMembershipEnforced}
                onClick={() => setAnnualMembershipEnforced((prev) => !prev)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2 disabled:opacity-50 ${
                  annualMembershipEnforced ? "bg-site-primary" : "bg-gray-200 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                    annualMembershipEnforced ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="rounded-lg border border-site-border bg-site-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-site-text">요금 정책 활성화</h2>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-site-text">결제 시스템 활성화</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.billingEnabled}
                onClick={() => setForm((f) => ({ ...f, billingEnabled: !f.billingEnabled }))}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2 disabled:opacity-50 ${
                  form.billingEnabled ? "bg-site-primary" : "bg-gray-200 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                    form.billingEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-site-text">대회 1회 이용권 가격 (원)</label>
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-site-text">클라이언트 당구장 연회원 가격 (원)</label>
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
            <Button href="/admin/platform" label="취소" color="contrast" outline />
            {error && <NotificationBar color="danger">{error}</NotificationBar>}
            {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
          </div>
        </form>
      </CardBox>
    </SectionMain>
  );
}

