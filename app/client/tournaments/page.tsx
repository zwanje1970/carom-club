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
    include: { organization: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">대회 관리</h1>
        <Link
          href="/client/tournaments/new"
          className="rounded-lg bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          대회 등록
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
                <th className="p-3 text-left font-medium">일시</th>
                <th className="p-3 text-left font-medium">장소</th>
                <th className="p-3 text-left font-medium">상태</th>
                <th className="p-3 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr key={t.id} className="border-b border-site-border last:border-0">
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-gray-600">{new Date(t.startAt).toLocaleString("ko-KR")}</td>
                  <td className="p-3 text-gray-600">{t.venue ?? "-"}</td>
                  <td className="p-3">{STATUS_LABEL[t.status] ?? t.status}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/client/tournaments/${t.id}`}
                      className="text-site-primary hover:underline"
                    >
                      관리
                    </Link>
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
