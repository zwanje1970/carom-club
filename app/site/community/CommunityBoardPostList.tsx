/** 커뮤니티 게시판 목록 공통 — 목록용 필드만 사용 (본문·댓글 내용·이미지 없음) */

import Link from "next/link";
import type { CommunityPostListItem } from "../../../lib/server/dev-store";

export type CommunityBoardListItem = CommunityPostListItem;

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
  items: CommunityBoardListItem[];
};

export default function CommunityBoardPostList({ boardType, items }: Props) {
  return (
    <ul
      className="ui-community-board-list-items"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {items.map((post) => (
        <li
          key={post.id}
          style={{
            padding: "0.85rem 0",
            borderBottom: "1px solid var(--v3-border, #e8e8e8)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gridTemplateRows: "auto auto",
              columnGap: "0.65rem",
              rowGap: 0,
              alignItems: "start",
              minWidth: 0,
            }}
          >
            <Link
              href={`/site/community/${boardType}/${post.id}`}
              style={{
                gridColumn: 1,
                gridRow: 1,
                fontSize: "1rem",
                fontWeight: 600,
                lineHeight: 1.35,
                color: "var(--v3-fg, #111)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
                minWidth: 0,
                textDecoration: "none",
                display: "block",
              }}
            >
              {post.title}
            </Link>
            <div
              aria-label={`댓글 ${post.commentCount}개`}
              style={{
                gridColumn: 2,
                gridRow: 1,
                minWidth: "2.75rem",
                minHeight: "2.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 0.5rem",
                borderRadius: "0.35rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                lineHeight: 1,
                color: "#000000",
                backgroundColor: "#d1d5db",
              }}
            >
              {post.commentCount}
            </div>
            <p
              className="v3-muted"
              style={{
                gridColumn: 1,
                gridRow: 2,
                margin: "0.4rem 0 0",
                fontSize: "0.82rem",
                lineHeight: 1.4,
                color: "var(--v3-muted-foreground, #6b7280)",
              }}
            >
              {post.nickname} · {formatListDateTime(post.createdAt)} · 조회 {post.viewCount}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
