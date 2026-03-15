import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "마감",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

export default async function ClientParticipantsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">참가자 관리</h1>
        <p className="text-gray-600">먼저 업체 설정을 완료해 주세요.</p>
        <Link href="/client/setup" className="inline-block rounded-lg bg-site-primary px-4 py-2 text-white hover:opacity-90">
          업체 설정
        </Link>
      </div>
    );
  }

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: { startAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">참가자 관리</h1>
      <p className="text-sm text-gray-600">
        대회별 참가자 목록·확정·출석은 각 대회의 참가자 탭에서 관리할 수 있습니다.
      </p>
      {tournaments.length === 0 ? (
        <p className="text-gray-500">등록된 대회가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {tournaments.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-site-border bg-site-card p-4"
            >
              <span className="font-medium text-site-text">{t.name}</span>
              <span className="text-sm text-gray-500">{STATUS_LABEL[t.status] ?? t.status} · 참가 {t._count.entries}명</span>
              <Link
                href={`/client/tournaments/${t.id}/participants`}
                className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                참가자 관리
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
