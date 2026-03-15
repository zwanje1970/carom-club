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

export default async function ClientTournamentsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">대회 관리</h1>
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
    include: {
      organization: { select: { name: true } },
      _count: { select: { entries: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">내 대회</h1>
        <Link
          href="/client/tournaments/new"
          className="rounded-lg bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          새 대회 만들기
        </Link>
      </div>
      {tournaments.length === 0 ? (
        <p className="text-gray-500">등록된 대회가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                <th className="p-3 text-left font-medium">대회명</th>
                <th className="p-3 text-left font-medium">상태</th>
                <th className="p-3 text-left font-medium">참가자</th>
                <th className="p-3 text-left font-medium">일시</th>
                <th className="p-3 text-left font-medium">수정일</th>
                <th className="p-3 text-right font-medium">바로가기</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr key={t.id} className="border-b border-site-border last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-medium">
                    <Link href={`/client/tournaments/${t.id}`} className="text-site-primary hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="p-3">{STATUS_LABEL[t.status] ?? t.status}</td>
                  <td className="p-3 text-gray-600">{t._count.entries}명</td>
                  <td className="p-3 text-gray-600">{new Date(t.startAt).toLocaleString("ko-KR")}</td>
                  <td className="p-3 text-gray-600">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</td>
                  <td className="p-3 text-right">
                    <span className="flex flex-wrap justify-end gap-2">
                      <Link href={`/client/tournaments/${t.id}`} className="text-site-primary hover:underline">
                        상세
                      </Link>
                      <Link href={`/client/tournaments/${t.id}/edit`} className="text-site-primary hover:underline">
                        수정
                      </Link>
                      <Link href={`/client/tournaments/${t.id}/participants`} className="text-site-primary hover:underline">
                        참가자
                      </Link>
                      <Link href={`/client/tournaments/${t.id}/bracket`} className="text-site-primary hover:underline">
                        대진표
                      </Link>
                      <Link href={`/client/tournaments/${t.id}/results`} className="text-site-primary hover:underline">
                        결과
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
