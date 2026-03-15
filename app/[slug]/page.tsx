import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export const dynamic = "force-dynamic";

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  type: string;
};

/** slug 페이지 SEO: meta title / description 구조 (향후 당구장 홍보 페이지 확장용) */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isDatabaseConfigured()) return { title: "당구장" };
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true, shortDescription: true, description: true },
  });
  if (!org) return { title: "당구장" };
  const title = org.name;
  const description =
    org.shortDescription?.trim() ||
    (org.description ? org.description.replace(/\s+/g, " ").trim().slice(0, 160) : undefined);
  return {
    title,
    description: description ?? undefined,
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let org: OrgRow | null = null;

  if (isDatabaseConfigured()) {
    const row = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        type: true,
      },
    });
    org = row as OrgRow | null;
  }

  if (!org) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-site-bg">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-site-text">{org.name}</h1>
        {org.shortDescription && (
          <p className="mt-2 text-site-text-muted">{org.shortDescription}</p>
        )}
        <dl className="mt-6 space-y-2 text-sm">
          {org.address && (
            <>
              <dt className="text-site-text-muted">주소</dt>
              <dd className="text-site-text">{org.address}</dd>
            </>
          )}
          {org.phone && (
            <>
              <dt className="text-site-text-muted">전화번호</dt>
              <dd className="text-site-text">{org.phone}</dd>
            </>
          )}
          {org.email && (
            <>
              <dt className="text-site-text-muted">이메일</dt>
              <dd className="text-site-text">{org.email}</dd>
            </>
          )}
          {org.website && (
            <>
              <dt className="text-site-text-muted">웹사이트</dt>
              <dd>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-primary hover:underline"
                >
                  {org.website}
                </a>
              </dd>
            </>
          )}
        </dl>
        <p className="mt-8 text-xs text-site-text-muted">
          당구장 전용 페이지 디자인과 홍보 기능은 이후 단계에서 추가됩니다.
        </p>
      </div>
    </main>
  );
}
