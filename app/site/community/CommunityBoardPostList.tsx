/** 커뮤니티 게시판 목록 — 가벼운 게시판형 리스트 */

import Link from "next/link";
import type { CommunityPostListItem } from "../../../lib/server/dev-store";
import { COMMUNITY_ROOM_PREFIX_SHORT, isPrimaryTabKey } from "./community-tab-config";

function formatListDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  const [datePart, timePart] = s.split(" ");
  if (!datePart || !timePart) return "";
  const [, m, day] = datePart.split("-");
  const [hh, min] = timePart.split(":");
  if (!m || !day || hh === undefined || min === undefined) return "";
  return `${m}.${day} ${hh}:${min}`;
}

type Props = {
  /** 전체 탭에서만 방 이름 접두어 */
  showRoomPrefix: boolean;
  items: CommunityPostListItem[];
};

export default function CommunityBoardPostList({ showRoomPrefix, items }: Props) {
  if (items.length === 0) {
    return <p className="v3-muted ui-community-board-empty">게시글이 없습니다.</p>;
  }
  return (
    <ul className="ui-community-board-rows">
      {items.map((post) => {
        const href = `/site/community/${post.boardType}/${post.id}`;
        const prefix =
          showRoomPrefix && isPrimaryTabKey(post.boardType)
            ? COMMUNITY_ROOM_PREFIX_SHORT[post.boardType]
            : null;
        return (
          <li key={post.id} className="ui-community-board-row">
            <div className="ui-community-board-row-main">
              <Link href={href} className="ui-community-board-title-link">
                {prefix ? (
                  <>
                    <span className="ui-community-board-prefix">[{prefix}]</span>
                    <span className="ui-community-board-title">{post.title}</span>
                  </>
                ) : (
                  <span className="ui-community-board-title">{post.title}</span>
                )}
              </Link>
              <p className="ui-community-board-meta">
                {post.nickname} · {formatListDateTime(post.createdAt)} · 조회 {post.viewCount}
              </p>
            </div>
            <div className="ui-community-board-row-aside">
              {post.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="ui-community-board-thumb"
                  src={post.thumbnailUrl}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <span className="ui-community-board-comments">댓글 {post.commentCount}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
