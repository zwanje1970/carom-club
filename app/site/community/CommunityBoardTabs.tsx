import Link from "next/link";
import type { CommunityHubTabKey } from "./community-tab-config";

type TabItem = { key: CommunityHubTabKey; label: string; href: string };

export default function CommunityBoardTabs({ tabs, currentKey }: { tabs: TabItem[]; currentKey: CommunityHubTabKey }) {
  if (tabs.length === 0) return null;
  return (
    <nav className="ui-community-tabs" aria-label="게시판 구분">
      <ul className="ui-community-tabs-list">
        {tabs.map((t) => (
          <li key={t.key} className="ui-community-tabs-item">
            <Link
              href={t.href}
              className={`ui-community-tabs-link${t.key === currentKey ? " ui-community-tabs-link--active" : ""}`}
              aria-current={t.key === currentKey ? "page" : undefined}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
