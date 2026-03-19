"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import { formatKoreanDate } from "@/lib/format-date";

type Plan = { id: string; code: string; name: string };
type Feature = { id: string; code: string; name: string };
type Sub = { id: string; startedAt: string; expiresAt: string | null; status: string; sourceType: string; notes: string | null; plan: { code: string; name: string } };
type Acc = { id: string; startedAt: string; expiresAt: string | null; status: string; sourceType: string; notes: string | null; feature: { code: string; name: string } };

export function AdminOrganizationGrants({ organizationId }: { organizationId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [subscriptions, setSubscriptions] = useState<Sub[]>([]);
  const [featureAccess, setFeatureAccess] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [subPlanId, setSubPlanId] = useState("");
  const [subExpiresAt, setSubExpiresAt] = useState("");
  const [subNotes, setSubNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState("");
  const [featFeatureId, setFeatFeatureId] = useState("");
  const [featExpiresAt, setFeatExpiresAt] = useState("");
  const [featNotes, setFeatNotes] = useState("");
  const [featSubmitting, setFeatSubmitting] = useState(false);
  const [featError, setFeatError] = useState("");

  const base = `/api/admin/organizations/${organizationId}`;

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/pricing-plans").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/features").then((r) => r.ok ? r.json() : []),
      fetch(`${base}/subscriptions`).then((r) => r.ok ? r.json() : []),
      fetch(`${base}/feature-access`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([pList, fList, subList, accList]) => {
        setPlans(Array.isArray(pList) ? pList : []);
        setFeatures(Array.isArray(fList) ? fList.filter((f: Feature) => f.id) : []);
        setSubscriptions(Array.isArray(subList) ? subList : []);
        setFeatureAccess(Array.isArray(accList) ? accList : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [organizationId]);

  async function grantSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!subPlanId) return;
    setSubmitting(true);
    setSubError("");
    try {
      const body: { planId: string; sourceType: string; notes?: string; expiresAt?: string } = {
        planId: subPlanId,
        sourceType: "MANUAL",
      };
      if (subNotes.trim()) body.notes = subNotes.trim();
      if (subExpiresAt) body.expiresAt = new Date(subExpiresAt).toISOString();
      const res = await fetch(`${base}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(data?.error ?? "부여 실패");
        return;
      }
      setSubPlanId("");
      setSubExpiresAt("");
      setSubNotes("");
      load();
    } catch {
      setSubError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function grantFeature(e: React.FormEvent) {
    e.preventDefault();
    if (!featFeatureId) return;
    setFeatSubmitting(true);
    setFeatError("");
    try {
      const body: { featureId: string; notes?: string; expiresAt?: string } = {
        featureId: featFeatureId,
      };
      if (featNotes.trim()) body.notes = featNotes.trim();
      if (featExpiresAt) body.expiresAt = new Date(featExpiresAt).toISOString();
      const res = await fetch(`${base}/feature-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeatError(data?.error ?? "부여 실패");
        return;
      }
      setFeatFeatureId("");
      setFeatExpiresAt("");
      setFeatNotes("");
      load();
    } catch {
      setFeatError("요청 중 오류가 발생했습니다.");
    } finally {
      setFeatSubmitting(false);
    }
  }

  if (loading) {
    return (
      <CardBox>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
          구독/기능 부여
        </h2>
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </CardBox>
    );
  }

  return (
    <CardBox>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
        구독/기능 부여
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        테스트/무료운영/예외 부여 시 사용합니다. 연회원 부여 시 plan에서 annual_membership을 선택하세요.
      </p>

      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-site-text">현재 구독</h3>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500">없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {subscriptions.map((s) => (
                <li key={s.id}>
                  {s.plan.name} ({s.plan.code}) · {s.status} · 출처: {s.sourceType}
                  {s.expiresAt && ` · 만료: ${formatKoreanDate(s.expiresAt)}`}
                  {s.notes && ` · 메모: ${s.notes}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={grantSubscription} className="flex flex-wrap items-end gap-3 rounded border border-site-border bg-gray-50 p-3 dark:bg-slate-800/50">
          <div>
            <label className="block text-xs text-gray-500">요금제</label>
            <select
              value={subPlanId}
              onChange={(e) => setSubPlanId(e.target.value)}
              className="mt-0.5 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            >
              <option value="">선택</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">만료일(선택)</label>
            <input
              type="date"
              value={subExpiresAt}
              onChange={(e) => setSubExpiresAt(e.target.value)}
              className="mt-0.5 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">메모(선택)</label>
            <input
              type="text"
              value={subNotes}
              onChange={(e) => setSubNotes(e.target.value)}
              placeholder="테스트 부여 등"
              className="mt-0.5 w-32 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !subPlanId}
            className="rounded bg-site-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {submitting ? "처리 중" : "구독 부여"}
          </button>
          {subError && <p className="w-full text-sm text-red-600">{subError}</p>}
        </form>

        <div>
          <h3 className="mb-2 text-sm font-medium text-site-text">현재 기능 부여</h3>
          {featureAccess.length === 0 ? (
            <p className="text-sm text-gray-500">없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {featureAccess.map((a) => (
                <li key={a.id}>
                  {a.feature.name} ({a.feature.code}) · {a.status} · 출처: {a.sourceType}
                  {a.expiresAt && ` · 만료: ${formatKoreanDate(a.expiresAt)}`}
                  {a.notes && ` · 메모: ${a.notes}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={grantFeature} className="flex flex-wrap items-end gap-3 rounded border border-site-border bg-gray-50 p-3 dark:bg-slate-800/50">
          <div>
            <label className="block text-xs text-gray-500">기능</label>
            <select
              value={featFeatureId}
              onChange={(e) => setFeatFeatureId(e.target.value)}
              className="mt-0.5 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            >
              <option value="">선택</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">만료일(선택)</label>
            <input
              type="date"
              value={featExpiresAt}
              onChange={(e) => setFeatExpiresAt(e.target.value)}
              className="mt-0.5 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">메모(선택)</label>
            <input
              type="text"
              value={featNotes}
              onChange={(e) => setFeatNotes(e.target.value)}
              placeholder="테스트 부여 등"
              className="mt-0.5 w-32 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={featSubmitting || !featFeatureId}
            className="rounded bg-site-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {featSubmitting ? "처리 중" : "기능 부여"}
          </button>
          {featError && <p className="w-full text-sm text-red-600">{featError}</p>}
        </form>
      </div>
    </CardBox>
  );
}
