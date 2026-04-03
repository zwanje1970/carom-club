"use client";

import { useState } from "react";
import Link from "next/link";

type SessionInfo = {
  role: string;
  loginMode: string;
};

type ClientMenuItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "switch-dashboard"; label: string };

type Group = {
  id: string;
  label: string;
  links: { href: string; label: string }[];
};

const STATIC_GROUPS: Group[] = [
  {
    id: "activity",
    label: "내 활동",
    links: [
      { href: "/mypage?tab=entries", label: "참가 대회" },
      { href: "/mypage?tab=applications", label: "신청 내역" },
      { href: "/mypage/community", label: "커뮤니티 활동" },
    ],
  },
  {
    id: "account",
    label: "계정 관리",
    links: [
      { href: "/mypage/edit", label: "회원정보 수정" },
      { href: "/login/forgot-password", label: "비밀번호 재설정" },
    ],
  },
  {
    id: "support",
    label: "고객센터",
    links: [
      { href: "/community/boards/notice", label: "공지사항" },
      { href: "/apply/client", label: "클라이언트 안내" },
    ],
  },
];

function getClientSectionItems(session: SessionInfo): ClientMenuItem[] {
  const items: ClientMenuItem[] = [];
  if (session.role === "CLIENT_ADMIN") {
    if (session.loginMode === "client") {
      items.push({ kind: "link", href: "/client/dashboard", label: "클라이언트 대시보드" });
    } else {
      items.push({ kind: "switch-dashboard", label: "클라이언트 대시보드" });
    }
  }
  items.push({ kind: "link", href: "/mypage/client-apply", label: "클라이언트 신청" });
  return items;
}

export function MypageAccordion({ session }: { session: SessionInfo }) {
  const [openId, setOpenId] = useState<string | null>("activity");
  const [switchingDashboard, setSwitchingDashboard] = useState(false);

  async function handleSwitchToClientDashboard() {
    setSwitchingDashboard(true);
    try {
      const res = await fetch("/api/auth/switch-client", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "클라이언트 모드 전환에 실패했습니다.");
        return;
      }
      window.location.href = "/client?welcome=1";
    } catch {
      alert("클라이언트 모드 전환에 실패했습니다.");
    } finally {
      setSwitchingDashboard(false);
    }
  }

  const clientItems = getClientSectionItems(session);
  const itemClass =
    "block w-full px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <div className="space-y-1">
      {STATIC_GROUPS.slice(0, 2).map((group) => {
        const isOpen = openId === group.id;
        return (
          <div
            key={group.id}
            className="rounded-xl border border-gray-200 overflow-hidden dark:border-slate-600"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : group.id)}
              className="flex w-full items-center justify-between bg-white px-4 py-3.5 text-left text-sm font-semibold text-site-text hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span>{group.label}</span>
              <span className="text-gray-400" aria-hidden>
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-slate-600">
                {group.links.map(({ href, label }) => (
                  <Link key={href + label} href={href} prefetch={false} className={itemClass}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-xl border border-gray-200 overflow-hidden dark:border-slate-600">
        <button
          type="button"
          onClick={() => setOpenId(openId === "client" ? null : "client")}
          className="flex w-full items-center justify-between bg-white px-4 py-3.5 text-left text-sm font-semibold text-site-text hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <span>클라이언트</span>
          <span className="text-gray-400" aria-hidden>
            {openId === "client" ? "▲" : "▼"}
          </span>
        </button>
        {openId === "client" && (
          <div className="border-t border-gray-100 dark:border-slate-600">
            {clientItems.map((item) =>
              item.kind === "link" ? (
                <Link key={item.href + item.label} href={item.href} prefetch={false} className={itemClass}>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  disabled={switchingDashboard}
                  onClick={handleSwitchToClientDashboard}
                  className={itemClass}
                >
                  {switchingDashboard ? "전환 중…" : item.label}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {STATIC_GROUPS.slice(2).map((group) => {
        const isOpen = openId === group.id;
        return (
          <div
            key={group.id}
            className="rounded-xl border border-gray-200 overflow-hidden dark:border-slate-600"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : group.id)}
              className="flex w-full items-center justify-between bg-white px-4 py-3.5 text-left text-sm font-semibold text-site-text hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span>{group.label}</span>
              <span className="text-gray-400" aria-hidden>
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-slate-600">
                {group.links.map(({ href, label }) => (
                  <Link key={href + label} href={href} prefetch={false} className={itemClass}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
