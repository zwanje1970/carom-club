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
  type: string;
  status: string;
  organizationName: string;
  applicantName: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectedReason: string | null;
  rejectReason?: string | null;
};

export function ClientApplicationSection() {
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

  const statusLabel = application
    ? STATUS_LABEL[application.status] ?? application.status
    : "미신청";

  const buttonLabel = !application
    ? "클라이언트 신청"
    : application.status === "PENDING"
      ? "클라이언트"
      : application.status === "REJECTED"
        ? "승인거절"
        : application.status === "APPROVED"
          ? "등록완료"
          : statusLabel;

  const rejectReason =
    application?.status === "REJECTED"
      ? (application.rejectedReason ?? application.rejectReason ?? "")
      : "";

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        클라이언트 등록 신청
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        당구장·동호회·연맹·주최자·강사로 활동하시려면 신청해 주세요. 승인 후 업체를 등록하고 대회·레슨을 운영할 수 있습니다.
      </p>
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : (
        <div className="rounded-lg border border-site-border bg-gray-50 p-4">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[100px_1fr]">
            <dt className="text-gray-500">신청 상태</dt>
            <dd>
              <span
                className={
                  application?.status === "APPROVED"
                    ? "text-green-700 font-medium"
                    : application?.status === "REJECTED"
                      ? "text-red-700 font-medium"
                      : application?.status === "PENDING"
                        ? "text-amber-700 font-medium"
                        : "text-gray-700"
                }
              >
                {statusLabel}
              </span>
            </dd>
            {application && (
              <>
                <dt className="text-gray-500">업체명</dt>
                <dd>{application.organizationName}</dd>
                <dt className="text-gray-500">신청일</dt>
                <dd>
                  {new Date(application.createdAt).toLocaleDateString("ko-KR")}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!application || application.status === "REJECTED" ? (
              <Link
                href="/mypage/client-apply"
                className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {buttonLabel}
              </Link>
            ) : application.status === "APPROVED" ? (
              <Link
                href="/client/dashboard"
                className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {buttonLabel}
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-gray-600">
                {buttonLabel}
              </span>
            )}
          </div>
          {rejectReason && (
            <p className="mt-2 text-xs text-gray-500">
              거절사유: {rejectReason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
