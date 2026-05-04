import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";
import SiteTournamentDetailSections from "../../../site/tournaments/[id]/site-tournament-detail-sections";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById } from "../../../../lib/surface-read";
import PlatformTournamentSoftDeleteButton from "../PlatformTournamentSoftDeleteButton";

export const dynamic = "force-dynamic";

export default async function PlatformTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) notFound();

  const isLifecycleDeleted = tournament.status === "DELETED";
  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">
        <Link href="/platform/tournaments" prefetch={false}>
          ← 대회 목록
        </Link>
        {" · "}
        <Link href="/platform/data/deleted" prefetch={false}>
          삭제된 항목 (백업함)
        </Link>
      </p>
      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <Link className="v3-btn" href={`/platform/tournaments/${id}/cards`} prefetch={false}>
          게시 카드 관리
        </Link>
        <PlatformTournamentSoftDeleteButton tournamentId={id} disabled={isLifecycleDeleted} />
      </div>
      {isLifecycleDeleted ? <p className="v3-muted">이 대회는 백업함(DELETED) 상태입니다.</p> : null}

      <SiteTournamentDetailSections
        tournament={tournament}
        listBackHref="/platform/tournaments"
        audience="client"
        outlinePdfFileKind={outlinePdfFileKind}
      />
    </main>
  );
}
