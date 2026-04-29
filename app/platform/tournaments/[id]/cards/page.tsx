import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentByIdFirestore } from "../../../../../lib/server/firestore-tournaments";
import { loadTournamentPublishedCardsArray } from "../../../../../lib/platform-api";
import PlatformPublishedCardSoftDeleteButton from "../../PlatformPublishedCardSoftDeleteButton";

export const dynamic = "force-dynamic";

export default async function PlatformTournamentPublishedCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) notFound();

  const cards = (await loadTournamentPublishedCardsArray()).filter((c) => c.tournamentId === id);

  return (
    <main className="v3-page v3-stack">
      <p className="v3-muted">
        <Link href={`/platform/tournaments/${id}`}>← 대회 상세</Link>
        {" · "}
        <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
      </p>
      <h1 className="v3-h1">게시 카드 관리</h1>
      <p className="v3-muted">{tournament.title}</p>

      {cards.length === 0 ? (
        <p className="v3-muted">노출 중인 게시 카드가 없습니다.</p>
      ) : (
        <ul className="v3-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: "1rem" }}>
          {cards.map((c) => (
            <li key={c.snapshotId} className="v3-box v3-stack">
              <strong>{c.title || "(제목 없음)"}</strong>
              <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                snapshotId: {c.snapshotId}
              </span>
              <PlatformPublishedCardSoftDeleteButton tournamentId={id} snapshotId={c.snapshotId} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
