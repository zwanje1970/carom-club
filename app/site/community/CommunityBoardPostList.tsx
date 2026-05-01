/** 커뮤니티 게시판 목록 — 가벼운 게시판형 리스트 */

import Link from "next/link";
import type { CommunityPostListItem, SiteCommunityBoardKey, SiteCommunityConfig } from "../../../lib/types/entities";
import {
  COMMUNITY_ROOM_PREFIX_SHORT,
  communityPostDetailHref,
  communityTabLabelForBoard,
  isPrimaryTabKey,
} from "./community-tab-config";
import SiteListImage160 from "../components/SiteListImage160";

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
  /** 전체 탭에서만 방 이름 접두어 — 예비 게시판 라벨은 `config` 필요 */
  showRoomPrefix: boolean;
  /** `showRoomPrefix`일 때 extra1·extra2 pill에 플랫폼 설정 표시명 반영 */
  config?: SiteCommunityConfig;
  items: CommunityPostListItem[];
  /** 빈 목록 1줄 문구(표시용) */
  emptyTitle?: string;
  /** 빈 목록 2줄 문구(표시용) */
  emptyDesc?: string;
};

export default function CommunityBoardPostList({
  showRoomPrefix,
  config,
  items,
  emptyTitle,
  emptyDesc,
}: Props) {
  const emptyTitleLine = emptyTitle ?? "게시글이 없습니다.";
  const emptyDescLine = emptyDesc ?? "첫 글을 작성해보세요.";

  return (
    <ul className="ui-community-board-rows">
      {items.length === 0 ? (
        <li className="ui-community-board-row ui-community-board-row--empty" role="status">
          <div className="ui-community-board-empty-inner">
            <p className="ui-community-board-empty-title">{emptyTitleLine}</p>
            <p className="ui-community-board-empty-desc v3-muted">{emptyDescLine}</p>
          </div>
        </li>
      ) : (
        items.map((post) => {
          const href = communityPostDetailHref(post.boardType, post.id);
          const prefix = showRoomPrefix
            ? isPrimaryTabKey(post.boardType)
              ? COMMUNITY_ROOM_PREFIX_SHORT[post.boardType]
              : config
                ? communityTabLabelForBoard(post.boardType, config)
                : null
            : null;
          const thumb = typeof post.thumbnailUrl === "string" ? post.thumbnailUrl.trim() : "";
          return (
            <li key={post.id} className="ui-community-board-row">
              <Link prefetch={false} href={href} className="ui-community-board-row-link">
                <div className="ui-community-board-row-body">
                  <div className="ui-community-board-line1">
                    {prefix ? (
                      <span className={boardPillClass(post.boardType)}>{prefix}</span>
                    ) : null}
                    <span className="ui-community-board-title">{post.title}</span>
                  </div>
                  <p className="ui-community-board-meta">
                    {formatListDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글 {post.commentCount}
                  </p>
                </div>
                {thumb ? (
                  <div className="ui-community-board-thumb-wrap">
                    <SiteListImage160
                      className="ui-community-board-thumb"
                      src={thumb}
                      alt=""
                      placeholderClassName="ui-community-board-thumb-placeholder"
                    />
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })
      )}
    </ul>
  );
}
