import Link from "next/link";

/** 플랫폼관리자 전용 메뉴. 대회 실무(대회관리/참가자/대진표)는 제거, 대회 현황(모니터링)만 유지 */
const menu = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/tournaments", label: "대회 현황" },
  { href: "/admin/members", label: "회원관리" },
  { href: "/admin/inquiries", label: "문의관리" },
  { href: "/admin/venues", label: "클라이언트 목록" },
  { href: "/admin/fee-ledger", label: "회비 장부" },
  { href: "/admin/client-applications", label: "클라이언트 신청" },
  { href: "/admin/settings", label: "설정" },
];

export function AdminSidebar() {
  return (
    <aside className="w-56 bg-site-card text-site-text flex flex-col shrink-0 border-r border-site-border">
      <div className="p-4 border-b border-site-border">
        <Link href="/admin" className="font-bold text-site-text">
          CAROM 관리자
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm text-site-text hover:bg-site-bg hover:text-site-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
