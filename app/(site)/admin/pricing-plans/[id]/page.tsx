import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/feature-access";
import { AdminPlanFeaturesManager } from "./AdminPlanFeaturesManager";

export default async function AdminPricingPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  const { id } = await params;
  const plan = await prisma.pricingPlan.findUnique({
    where: { id },
    include: { planFeatures: { include: { feature: true } } },
  });
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/pricing-plans" className="text-site-primary hover:underline">← 요금제 목록</Link>
      </div>
      <h1 className="text-xl font-bold">{plan.name}</h1>
      <dl className="grid gap-2 text-sm">
        <dt className="text-gray-500">코드</dt>
        <dd className="font-mono">{plan.code}</dd>
        <dt className="text-gray-500">유형</dt>
        <dd>{plan.planType}</dd>
        <dt className="text-gray-500">결제 방식</dt>
        <dd>{plan.billingType}</dd>
        <dt className="text-gray-500">가격</dt>
        <dd>{formatPrice(plan.price, plan.currency)}</dd>
        <dt className="text-gray-500">활성</dt>
        <dd>{plan.isActive ? "예" : "아니오"}</dd>
      </dl>
      <AdminPlanFeaturesManager planId={id} planCode={plan.code} initialFeatures={plan.planFeatures.map((pf) => pf.feature)} />
    </div>
  );
}
