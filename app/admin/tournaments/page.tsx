import Link from "next/link";
import { mdiTrophy } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { formatKoreanDateTime } from "@/lib/format-date";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize-slug";
import { isPlatformAdmin } from "@/types/auth";
import { getTournamentsListAdminRaw, type TournamentListRow } from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST } from "@/lib/mock-data";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import PillTag from "@/components/admin/_components/PillTag";

function statusColor(
  status: string
): "success" | "danger" | "warning" | "info" | "contrast" | "light" | "dark" {
  switch (status) {
    case "OPEN":
      return "success";
    case "FINISHED":
      return "contrast";
    case "CLOSED":
      return "warning";
    case "DRAFT":
      return "light";
    case "HIDDEN":
      return "dark";
    default:
      return "light";
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "초안",
    OPEN: "모집중",
    CLOSED: "마감",
    FINISHED: "종료",
    HIDDEN: "숨김",
  };
  return map[status] ?? status;
}

export default async function AdminTournamentsPage() {
  let tournaments: TournamentListRow[] = await getTournamentsListAdminRaw();
  if (tournaments.length === 0) {
    tournaments = MOCK_TOURNAMENTS_LIST.map((t) => {
      const ext = t as unknown as { endAt?: string; imageUrl?: string; venueName?: string };
      const org = t.organization as { id: string; name: string; slug?: string } | null;
      return {
        id: t.id,
        name: t.name,
        startAt: new Date(t.startAt),
        endAt: ext.endAt ? new Date(ext.endAt) : null,
        status: t.status,
        organizationId: t.organizationId ?? "",
        venue: t.venue ?? null,
        venueName: ext.venueName ?? null,
        gameFormat: t.gameFormat ?? null,
        prizeInfo: null,
        imageUrl: ext.imageUrl ?? null,
        posterImageUrl: null,
        summary: null,
        maxParticipants: null,
        confirmedCount: 0,
        organization: org ? normalizeSlug(org) : null,
      };
    });
  }

  const session = await getSession();
  const isPlatform = session ? isPlatformAdmin(session) : false;
  let canCreateTournament = !isPlatform;
  if (!isPlatform && session) {
    try {
      const orgId = await getClientAdminOrganizationId(session);
      if (orgId) {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { type: true },
        });
        if (org?.type === "INSTRUCTOR") canCreateTournament = false;
      }
    } catch {
      // ignore
    }
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title={isPlatform ? "대회 현황" : "대회 목록"}>
        {canCreateTournament && (
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/admin/tournaments/new" label="이전 대회 불러오기" color="contrast" outline />
            <Button href="/admin/tournaments/new" label="대회 생성" color="info" />
          </div>
        )}
      </SectionTitleLineWithButton>

      <CardBox hasTable>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  대회명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  주최 클라이언트
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  일시
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  장소
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  경기방식
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                    등록된 대회가 없습니다.
                  </td>
                </tr>
              ) : (
                tournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Link
                        href={`/admin/tournaments/${t.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                      {t.organization?.name ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                      {formatKoreanDateTime(t.startAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                      {t.venue ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <PillTag color={statusColor(t.status)} label={statusLabel(t.status)} small />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                      {t.gameFormat ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBox>
    </SectionMain>
  );
}
