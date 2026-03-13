"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "신청중",
  REJECTED: "승인거절",
  APPROVED: "등록완료",
};

type Application = {
  id: string;
  status: string;
  organizationName: string;
  rejectedReason?: string | null;
  rejectReason?: string | null;
};

export function ClientApplyBottomCta() {
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);

  useEffect(() => {
    fetch("/api/mypage/client-application")
      .then((res) => res.json())
      .then((data: { application?: Application | null }) => {
        setApplication(data.application ?? null);
      })
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const rejectReason =
    application?.status === "REJECTED"
      ? (application.rejectedReason ?? application.rejectReason ?? "").trim()
      : "";

  // 미신청: 클라이언트 신청 버튼만
  if (!application) {
    return (
      <div className="mt-6 pt-4 border-t border-site-border flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
        <Link
          href="/mypage/client-apply"
          className="inline-flex items-center rounded border border-site-border bg-site-card px-2.5 py-1 text-gray-500 hover:bg-site-primary/10 hover:text-site-primary"
        >
          클라이언트 신청
        </Link>
      </div>
    );
  }

  // 신청중 / 승인거절 / 등록완료: "클라이언트 | 상태(사유)" 1개 표시, 신청 버튼 없음
  const displayText =
    application.status === "REJECTED"
      ? `클라이언트 | 승인거절${rejectReason ? `(${rejectReason})` : ""}`
      : application.status === "PENDING"
        ? "클라이언트 | 신청중"
        : application.status === "APPROVED"
          ? "클라이언트 | 등록완료"
          : `클라이언트 | ${STATUS_LABEL[application.status] ?? application.status}`;

  return (
    <div className="mt-6 pt-4 border-t border-site-border flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
      <span className="text-gray-500">{displayText}</span>
      {application.status === "PENDING" && (
        <Link
          href="/mypage/client-apply"
          className="inline-flex items-center rounded border border-site-border bg-site-card px-2.5 py-1 text-gray-500 hover:bg-site-primary/10 hover:text-site-primary"
        >
          신청내역 확인
        </Link>
      )}
      {application.status === "APPROVED" && (
        <Link
          href="/client/dashboard"
          className="inline-flex items-center rounded border border-site-border bg-site-card px-2.5 py-1 text-site-primary hover:bg-site-primary/5"
        >
          대시보드
        </Link>
      )}
      {application.status === "REJECTED" && (
        <Link
          href="/mypage/client-apply"
          className="inline-flex items-center rounded border border-site-border bg-site-card px-2.5 py-1 text-gray-500 hover:bg-site-primary/10 hover:text-site-primary"
        >
          재신청
        </Link>
      )}
    </div>
  );
}
