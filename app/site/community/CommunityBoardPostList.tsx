/** 커뮤니티 게시판 목록 — 가벼운 게시판형 리스트 */

import Link from "next/link";
import type { CommunityPostListItem } from "../../../lib/server/dev-store";

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
  boardType: string;
  boardLabel: string;
  items: CommunityPostListItem[];
};

export default function CommunityBoardPostList({ boardType, boardLabel, items }: Props) {
  if (items.length === 0) {
    return <p className="v3-muted ui-community-board-empty">게시글이 없습니다.</p>;
  }
  return (
    <ul className="ui-community-board-rows">
      {items.map((post) => (
        <li key={post.id} className="ui-community-board-row">
          <div className="ui-community-board-row-main">
            <Link href={`/site/community/${boardType}/${post.id}`} className="ui-community-board-title-link">
              <span className="ui-community-board-prefix">[{boardLabel}]</span>
              <span className="ui-community-board-title">{post.title}</span>
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
      ))}
    </ul>
  );
}
