"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LogoutButton from "../../components/LogoutButton";
import type { MypageClientMenuPayload } from "./mypage-client-types";
import "./site-mypage-client-ops.css";

export type SiteMypageUserSummary = {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  role: string;
};

export default function SiteMypageClient({
  user,
  hidePlatformDashboardLink = false,
}: {
  user: SiteMypageUserSummary;
  /** 앱(WebView) 등 — 플랫폼 대시보드 링크 비노출 */
  hidePlatformDashboardLink?: boolean;
}) {
  const [menuPayload, setMenuPayload] = useState<MypageClientMenuPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/site/mypage?part=footer", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad");
        const json = (await res.json()) as MypageClientMenuPayload;
        if (!cancelled) setMenuPayload(json);
      } catch {
        if (!cancelled) setMenuPayload({ clientApplicationStatus: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clientPending = menuPayload?.clientApplicationStatus === "PENDING";
  const clientApproved = menuPayload?.clientApplicationStatus === "APPROVED";

  const emailLine = user.email?.trim();
  const phoneLine = user.phone?.trim();
  const showMetaDl = Boolean(emailLine || phoneLine || clientApproved);

  const workspaceMenu =
    menuPayload === null ? (
      <p className="site-mypage-menu-loading v3-muted">메뉴 불러오는 중…</p>
    ) : clientApproved ? (
      <Link prefetch={false} href="/client" className="site-mypage-menu-row site-mypage-menu-row--workspace site-mypage-menu-row--client-ops">
        <div className="site-mypage-menu-row-main">
          <span className="site-mypage-menu-row-title">클라이언트 운영관리</span>
          <span className="site-mypage-menu-row-sub">
            <span className="site-mypage-menu-pill site-mypage-menu-pill--ops">운영</span>
            대회 운영 · 참가자 관리
          </span>
        </div>
        <span className="site-mypage-menu-row-chevron" aria-hidden>
          ›
        </span>
      </Link>
    ) : clientPending ? (
      <Link prefetch={false} href="/client-status/pending" className="site-mypage-menu-row site-mypage-menu-row--workspace">
        <div className="site-mypage-menu-row-main">
          <span className="site-mypage-menu-row-title">클라이언트 승인 대기</span>
          <span className="site-mypage-menu-row-sub">신청 처리 상태를 확인합니다</span>
        </div>
        <span className="site-mypage-menu-row-chevron" aria-hidden>
          ›
        </span>
      </Link>
    ) : user.role === "CLIENT" ? (
      <Link prefetch={false} href="/client" className="site-mypage-menu-row site-mypage-menu-row--workspace site-mypage-menu-row--client-ops">
        <div className="site-mypage-menu-row-main">
          <span className="site-mypage-menu-row-title">클라이언트 운영관리</span>
          <span className="site-mypage-menu-row-sub">
            <span className="site-mypage-menu-pill site-mypage-menu-pill--ops">운영</span>
            대회 운영 · 참가자 관리
          </span>
        </div>
        <span className="site-mypage-menu-row-chevron" aria-hidden>
          ›
        </span>
      </Link>
    ) : user.role === "PLATFORM" ? (
      hidePlatformDashboardLink ? (
        <p className="site-mypage-menu-note v3-muted">플랫폼 관리는 PC 웹 브라우저에서 이용해 주세요.</p>
      ) : (
        <Link prefetch={false} href="/platform" className="site-mypage-menu-row site-mypage-menu-row--workspace">
          <div className="site-mypage-menu-row-main">
            <span className="site-mypage-menu-row-title">플랫폼 대시보드</span>
            <span className="site-mypage-menu-row-sub">
              <span className="site-mypage-menu-pill site-mypage-menu-pill--platform">플랫폼</span>
              사이트·운영 설정
            </span>
          </div>
          <span className="site-mypage-menu-row-chevron" aria-hidden>
            ›
          </span>
        </Link>
      )
    ) : (
      <Link prefetch={false} href="/client-apply" className="site-mypage-menu-row">
        <div className="site-mypage-menu-row-main">
          <span className="site-mypage-menu-row-title">클라이언트 신청</span>
          <span className="site-mypage-menu-row-sub">대회 개최·운영 계정 신청</span>
        </div>
        <span className="site-mypage-menu-row-chevron" aria-hidden>
          ›
        </span>
      </Link>
    );

  return (
    <section className="site-site-gray-main v3-stack site-mypage-shell">
      <section className="card-clean site-detail-inner-stack site-mypage-summary-block">
        <h2 className="site-mypage-profile-heading">내 정보</h2>
        <div className="site-mypage-profile-head">
          <p className="site-mypage-profile-nickname">{user.nickname}</p>
          {user.name.trim() ? <p className="site-mypage-profile-name">{user.name.trim()}</p> : null}
        </div>
        {showMetaDl ? (
          <dl className="site-mypage-summary-dl site-mypage-summary-dl--meta">
            {emailLine ? (
              <div className="site-mypage-summary-row">
                <dt className="site-mypage-summary-dt">이메일</dt>
                <dd className="site-mypage-summary-dd">{emailLine}</dd>
              </div>
            ) : null}
            {phoneLine ? (
              <div className="site-mypage-summary-row">
                <dt className="site-mypage-summary-dt">전화번호</dt>
                <dd className="site-mypage-summary-dd">{phoneLine}</dd>
              </div>
            ) : null}
            {clientApproved ? (
              <div className="site-mypage-summary-row">
                <dt className="site-mypage-summary-dt">회원 구분</dt>
                <dd className="site-mypage-summary-dd">클라이언트 회원</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <Link prefetch={false} href="/site/mypage/edit" className="site-mypage-menu-row site-mypage-menu-row--in-summary">
          <div className="site-mypage-menu-row-main">
            <span className="site-mypage-menu-row-title">내 정보 수정</span>
            <span className="site-mypage-menu-row-sub">이름·연락처 변경</span>
          </div>
          <span className="site-mypage-menu-row-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </section>

      <nav className="site-mypage-footer-actions site-mypage-footer-actions--menu" aria-label="마이페이지 메뉴">
        <Link prefetch={false} href="/site/mypage/history" className="site-mypage-menu-row">
          <div className="site-mypage-menu-row-main">
            <span className="site-mypage-menu-row-title">대회 이력</span>
            <span className="site-mypage-menu-row-sub">신청·참가 기록 보기</span>
          </div>
          <span className="site-mypage-menu-row-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </nav>

      <div className="site-mypage-workspace-cta" aria-label="운영·워크스페이스">
        {workspaceMenu}
      </div>

      <div className="site-mypage-menu-actions-footer">
        <LogoutButton redirectTo="/site" className="site-mypage-menu-logout-btn secondary-button site-mypage-logout" />
      </div>
    </section>
  );
}
