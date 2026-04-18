import Link from "next/link";
import { getSiteCommunityConfig, type SiteCommunityBoardKey } from "../../../lib/server/dev-store";
import SiteShellFrame from "../components/SiteShellFrame";

type CommunityBoardItem = {
  key: SiteCommunityBoardKey;
  href: string;
};

const COMMUNITY_BOARD_ITEMS: CommunityBoardItem[] = [
  { key: "free", href: "/site/community/free" },
  { key: "qna", href: "/site/community/qna" },
  { key: "reviews", href: "/site/community/reviews" },
  { key: "extra1", href: "/site/community/extra1" },
  { key: "extra2", href: "/site/community/extra2" },
];

const BOARD_ICONS: Record<SiteCommunityBoardKey, string> = {
  free: "💬",
  qna: "❓",
  reviews: "⭐",
  extra1: "📌",
  extra2: "📎",
};

export default async function SiteCommunityPage() {
  let config = {
    free: { visible: true, label: "자유게시판", order: 1 },
    qna: { visible: true, label: "QnA", order: 2 },
    reviews: { visible: true, label: "대회후기", order: 3 },
    extra1: { visible: false, label: "예비게시판 1", order: 4 },
    extra2: { visible: false, label: "예비게시판 2", order: 5 },
  };
  try {
    config = await getSiteCommunityConfig();
  } catch {
    // fallback config is used as-is
  }

  const visibleBoards = COMMUNITY_BOARD_ITEMS
    .filter((item) => config[item.key].visible)
    .sort((a, b) => config[a.key].order - config[b.key].order);

  return (
    <SiteShellFrame brandTitle="커뮤니티">
      <section className="site-site-gray-main v3-stack ui-community-page">
        <ul className="ui-community-board-list">
          {visibleBoards.map((board) => (
            <li key={board.key}>
              <Link href={board.href} className="ui-community-card">
                <span className="ui-community-card-icon" aria-hidden>
                  {BOARD_ICONS[board.key]}
                </span>
                <span className="ui-community-card-label">{config[board.key].label}</span>
                <span className="ui-community-card-chevron" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SiteShellFrame>
  );
}
