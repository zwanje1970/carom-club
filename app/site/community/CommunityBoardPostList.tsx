/** 커뮤니티 게시판 목록 — 가벼운 게시판형 리스트 */

import Link from "next/link";
import type { CommunityPostListItem, SiteCommunityBoardKey } from "../../../lib/types/entities";
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

function boardPillClass(boardType: SiteCommunityBoardKey): string {
  const base = "ui-community-board-pill";
  if (boardType === "free") return `${base} ${base}--free`;
  if (boardType === "qna") return `${base} ${base}--qna`;
  if (boardType === "reviews") return `${base} ${base}--reviews`;
  return `${base} ${base}--muted`;
}

type Props = {
  /** 전체 탭에서만 방 이름 접두어 */
  showRoomPrefix: boolean;
  items: CommunityPostListItem[];
  /** 빈 목록 문구만 교체(표시용, API·데이터와 무관) */
  emptyTitle?: string;
  emptyDesc?: string;
};

export default function CommunityBoardPostList({
  showRoomPrefix,
  items,
  emptyTitle,
  emptyDesc,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="card-clean ui-community-board-empty" role="status">
        <p className="ui-community-board-empty-title">{emptyTitle ?? "아직 게시글이 없습니다"}</p>
        <p className="v3-muted ui-community-board-empty-desc">
          {emptyDesc ?? "첫 글을 남겨 보시면 여기에 표시됩니다."}
        </p>
      </div>
    );
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
              <div className="ui-community-board-title-line">
                {prefix ? (
                  <span className={boardPillClass(post.boardType)}>{prefix}</span>
                ) : null}
                <Link href={href} className="ui-community-board-title-link">
                  <span className="ui-community-board-title">{post.title}</span>
                </Link>
              </div>
              <p className="ui-community-board-meta">
                {post.nickname} · {formatListDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글{" "}
                {post.commentCount}
              </p>
            </div>
            <div className="ui-community-board-row-aside">
              {post.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="ui-community-board-thumb"
                  src={post.thumbnailUrl}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
