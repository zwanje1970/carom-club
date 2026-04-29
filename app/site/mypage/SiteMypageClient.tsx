"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import LogoutButton from "../../components/LogoutButton";
import type { MypageClientMenuPayload } from "./mypage-client-types";

const MypageNotificationsDeferred = dynamic(() => import("./MypageNotificationsDeferred"), {
  ssr: false,
  loading: () => (
    <section className="card-clean site-detail-inner-stack">
      <h2 className="site-mypage-card-title">최근 알림</h2>
      <p className="v3-muted" style={{ margin: 0 }}>
        불러오는 중…
      </p>
    </section>
  ),
});

const MypageApplicationsDeferred = dynamic(() => import("./MypageApplicationsDeferred"), {
  ssr: false,
  loading: () => (
    <section className="card-clean site-detail-inner-stack">
      <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
      <p className="v3-muted" style={{ margin: 0 }}>
        불러오는 중…
      </p>
    </section>
  ),
});

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
  const [summaryClientPayload, setSummaryClientPayload] = useState<MypageClientMenuPayload | null>(null);
  const [applicationsMount, setApplicationsMount] = useState(false);

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
        /* keep null — same as prior deferred failure (footer stayed loading) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onNotificationsFetchSettled = useCallback(() => {
    setApplicationsMount(true);
  }, []);

  const onNotificationsMenuMeta = useCallback((p: MypageClientMenuPayload) => {
    setSummaryClientPayload(p);
  }, []);

  const summaryClientApproved = summaryClientPayload?.clientApplicationStatus === "APPROVED";
  const clientPending = menuPayload?.clientApplicationStatus === "PENDING";
  const clientApproved = menuPayload?.clientApplicationStatus === "APPROVED";

  return (
    <section className="site-site-gray-main v3-stack site-mypage-shell">
      <section className="card-clean site-detail-inner-stack">
        <h2 className="site-mypage-card-title">내 정보 요약</h2>
        <dl className="site-mypage-summary-dl">
          <div className="site-mypage-summary-row">
            <dt className="site-mypage-summary-dt">닉네임</dt>
            <dd className="site-mypage-summary-dd">{user.nickname}</dd>
          </div>
          <div className="site-mypage-summary-row">
            <dt className="site-mypage-summary-dt">이름</dt>
            <dd className="site-mypage-summary-dd">{user.name}</dd>
          </div>
          <div className="site-mypage-summary-row">
            <dt className="site-mypage-summary-dt">이메일</dt>
            <dd className="site-mypage-summary-dd">{user.email ?? "-"}</dd>
          </div>
          <div className="site-mypage-summary-row">
            <dt className="site-mypage-summary-dt">전화번호</dt>
            <dd className="site-mypage-summary-dd">{user.phone ?? "-"}</dd>
          </div>
          {summaryClientApproved ? (
            <div className="site-mypage-summary-row">
              <dt className="site-mypage-summary-dt">회원 구분</dt>
              <dd className="site-mypage-summary-dd">클라이언트 회원</dd>
            </div>
          ) : null}
        </dl>
        <Link className="primary-button primary-button--block" href="/site/mypage/edit">
          내 정보 수정
        </Link>
      </section>

      <MypageNotificationsDeferred
        onFetchSettled={onNotificationsFetchSettled}
        onNotificationsMenuMeta={onNotificationsMenuMeta}
      />

      {applicationsMount ? (
        <MypageApplicationsDeferred />
      ) : (
        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
          <p className="v3-muted" style={{ margin: 0 }}>
            불러오는 중…
          </p>
        </section>
      )}

      <div className="site-mypage-footer-actions">
        {menuPayload === null ? (
          <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
            메뉴 불러오는 중…
          </span>
        ) : clientApproved ? (
          <Link className="secondary-button" href="/client">
            클라이언트 대시보드
          </Link>
        ) : clientPending ? (
          <Link className="secondary-button" href="/client-status/pending">
            클라이언트 승인 대기
          </Link>
        ) : user.role === "PLATFORM" ? (
          hidePlatformDashboardLink ? (
            <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
              플랫폼 관리는 PC 웹 브라우저에서 이용해 주세요.
            </span>
          ) : (
            <Link className="secondary-button" href="/platform">
              플랫폼 대시보드
            </Link>
          )
        ) : (
          <Link className="secondary-button" href="/client-apply">
            클라이언트 신청
          </Link>
        )}
        <Link className="secondary-button" href="/site/mypage/history" prefetch={false}>
          대회 이력 보기
        </Link>
        <LogoutButton redirectTo="/" className="secondary-button site-mypage-logout" />
      </div>
    </section>
  );
}
