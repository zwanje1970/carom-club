import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { PromoEditor } from "@/components/admin/PromoEditor";

export default async function ClientPromoPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">소속된 업체가 없습니다.</p>
        <Link href="/client/dashboard" className="mt-4 inline-block text-site-primary hover:underline">
          대시보드로
        </Link>
      </div>
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      promoDraft: true,
      promoPublished: true,
      promoPublishedAt: true,
    },
  });
  if (!org) {
    redirect("/client/dashboard");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-site-text">홍보 페이지 편집</h1>
        <Link
          href="/client/dashboard"
          className="text-sm text-gray-600 hover:text-site-primary"
        >
          ← 대시보드
        </Link>
      </div>
      <p className="text-sm text-gray-600">{org.name} · 공개 홍보 페이지에 노출되는 내용을 편집합니다.</p>
      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <PromoEditor
          organizationId={org.id}
          initialDraft={org.promoDraft ?? ""}
          initialPublished={org.promoPublished ?? ""}
          publishedAt={org.promoPublishedAt?.toISOString() ?? null}
          apiPath="/api/client/organization/promo"
        />
      </div>
    </div>
  );
}
