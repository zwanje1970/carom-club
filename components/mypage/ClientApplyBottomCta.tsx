"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Application = {
  id: string;
  status: string;
  rejectedReason?: string | null;
  rejectReason?: string | null;
};

type CtaResponse = {
  application?: Application | null;
};

const CTA_FETCH_URL = "/api/mypage/client-application?view=cta";

export function ClientApplyBottomCta() {
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(CTA_FETCH_URL, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: CtaResponse) => {
        setApplication(data.application ?? null);
      })
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div
        className="mt-6 min-h-[52px] rounded border-t border-site-border px-2 pt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="h-3 w-24 rounded bg-gray-200/80 dark:bg-slate-700/80" />
        <span className="h-6 w-16 rounded border border-site-border bg-site-card" />
      </div>
    );
  }

  const rejectReason =
    application?.status === "REJECTED"
      ? (application.rejectedReason ?? application.rejectReason ?? "").trim()
      : "";

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

  const displayText =
    application.status === "REJECTED"
      ? `클라이언트 | 승인거절${rejectReason ? `(${rejectReason})` : ""}`
      : application.status === "PENDING"
        ? "클라이언트 | 신청중"
        : application.status === "APPROVED"
          ? "클라이언트 | 등록완료"
          : `클라이언트 | ${application.status}`;

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