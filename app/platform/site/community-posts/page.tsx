import Link from "next/link";
import type { SiteCommunityBoardKey } from "../../../../lib/types/entities";
import { getSiteCommunityConfig, listCommunityPostsAllPrimary } from "../../../../lib/platform-api";
import PlatformCommunityPostSoftDeleteButton from "./PlatformCommunityPostSoftDeleteButton";

export const dynamic = "force-dynamic";

const ALL_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1", "extra2"];

export default async function PlatformCommunityPostsAdminPage() {
  const cfg = await getSiteCommunityConfig();
  const visible = ALL_BOARD_KEYS.filter((k) => cfg[k].visible);
  const posts = await listCommunityPostsAllPrimary(visible);

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">
        <Link href="/platform/site">← 사이트 관리</Link>
        {" · "}
        <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
      </p>
      <p className="v3-muted">공개 게시판에 노출 중인 글만 나열합니다. 삭제 시 백업함(DELETED)으로 이동합니다.</p>

      {posts.length === 0 ? (
        <p className="v3-muted">표시할 게시글이 없습니다.</p>
      ) : (
        <ul className="v3-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: "0.75rem" }}>
          {posts.map((p) => (
            <li key={p.id} className="v3-box v3-stack">
              <div className="v3-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div className="v3-stack" style={{ gap: "0.25rem" }}>
                  <Link href={`/site/community/${p.boardType}/${p.id}`} style={{ fontWeight: 600 }}>
                    {p.title}
                  </Link>
                  <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                    {p.boardType} · {p.nickname} · {p.createdAt}
                  </span>
                </div>
                <PlatformCommunityPostSoftDeleteButton postId={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
