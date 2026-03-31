"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/feature-access";

type Plan = {
  id: string;
  code: string;
  name: string;
  planType: string;
  billingType: string;
  price: number;
  currency: string;
  isActive: boolean;
  validDays: number | null;
  planFeatures: { feature: { code: string; name: string } }[];
};

const PLAN_TYPE_LABEL: Record<string, string> = {
  ANNUAL: "연회원",
  PACKAGE: "패키지",
  FEATURE: "단일기능",
};
const BILLING_LABEL: Record<string, string> = {
  ONE_TIME: "1회",
  YEARLY: "연간",
};

export function AdminPricingPlansList() {
  const [list, setList] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/admin/pricing-plans");
    if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    fetchList().catch(() => setError("목록을 불러오는 중 오류가 발생했습니다.")).finally(() => setLoading(false));
  }, [fetchList]);

  if (loading) return <p className="text-gray-500">불러오는 중...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (list.length === 0) return <p className="text-gray-500">등록된 요금제가 없습니다.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
            <th className="p-3 text-left font-medium">코드</th>
            <th className="p-3 text-left font-medium">이름</th>
            <th className="p-3 text-left font-medium">유형</th>
            <th className="p-3 text-left font-medium">결제</th>
            <th className="p-3 text-left font-medium">가격</th>
            <th className="p-3 text-left font-medium">포함 기능</th>
            <th className="p-3 text-left font-medium">활성</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-b border-site-border last:border-0">
              <td className="p-3 font-mono text-xs">{p.code}</td>
              <td className="p-3">
                <Link href={`/admin/pricing-plans/${p.id}`} className="text-site-primary hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="p-3">{PLAN_TYPE_LABEL[p.planType] ?? p.planType}</td>
              <td className="p-3">{BILLING_LABEL[p.billingType] ?? p.billingType}</td>
              <td className="p-3">{formatPrice(p.price, p.currency)}</td>
              <td className="p-3 text-gray-500">
                {p.planFeatures.length ? p.planFeatures.map((pf) => pf.feature.code).join(", ") : "—"}
              </td>
              <td className="p-3">{p.isActive ? "예" : "아니오"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
