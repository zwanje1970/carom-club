"use client";

import { useCallback, useMemo, useState } from "react";
import type { ClientApplication } from "../../../../lib/server/dev-store";
import ApplicationStatusUpdateForm from "./ApplicationStatusUpdateForm";

export type ClientApplicationSummaryPayload = {
  application: ClientApplication;
  userDisplayName: string | null;
};

type FilterTab = "pending" | "approved" | "rejected" | "bydate";

function statusLabel(status: ClientApplication["status"]): string {
  if (status === "PENDING") return "미확인";
  if (status === "APPROVED") return "승인";
  return "거절";
}

function formatTableDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: "pending", label: "미확인" },
  { id: "approved", label: "승인" },
  { id: "rejected", label: "거절" },
  { id: "bydate", label: "신청일" },
];

export default function ClientApplicationsTableClient({
  initialSummaries,
}: {
  initialSummaries: ClientApplicationSummaryPayload[];
}) {
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [selected, setSelected] = useState<ClientApplicationSummaryPayload | null>(null);

  const rows = useMemo(() => {
    const list = initialSummaries.slice();
    if (filter === "pending") {
      return list.filter((r) => r.application.status === "PENDING");
    }
    if (filter === "approved") {
      return list.filter((r) => r.application.status === "APPROVED");
    }
    if (filter === "rejected") {
      return list.filter((r) => r.application.status === "REJECTED");
    }
    return list.sort((a, b) => b.application.createdAt.localeCompare(a.application.createdAt));
  }, [initialSummaries, filter]);

  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <>
      <div className="ui-platform-app-tabs" role="tablist" aria-label="신청 목록 구분">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`ui-platform-app-tab${filter === tab.id ? " ui-platform-app-tab--active" : ""}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ui-platform-app-table-wrap">
        {rows.length === 0 ? (
          <p className="v3-muted" style={{ margin: "0.75rem 0" }}>
            해당 조건의 신청이 없습니다.
          </p>
        ) : (
          <table className="ui-platform-app-table">
            <thead>
              <tr>
                <th scope="col">신청일</th>
                <th scope="col">조직명</th>
                <th scope="col">승인상태</th>
                <th scope="col">승인일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { application: a } = row;
                const reviewed = a.reviewedAt ? formatTableDate(a.reviewedAt) : "—";
                return (
                  <tr
                    key={a.id}
                    className="ui-platform-app-table__row"
                    onClick={() => setSelected(row)}
                    title="클릭하여 상세 보기"
                  >
                    <td>{formatTableDate(a.createdAt)}</td>
                    <td className="ui-platform-app-table__org" title={a.organizationName}>
                      {a.organizationName}
                    </td>
                    <td>{statusLabel(a.status)}</td>
                    <td>{a.status === "PENDING" ? "—" : reviewed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div
          className="ui-platform-app-modal-backdrop"
          role="presentation"
          onClick={closeModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeModal();
          }}
        >
          <div
            className="ui-platform-app-modal v3-box v3-stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-app-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-platform-app-modal__head">
              <h2 id="platform-app-detail-title" className="v3-h2" style={{ margin: 0 }}>
                신청 상세
              </h2>
              <button type="button" className="ui-platform-app-modal__close v3-btn" onClick={closeModal} aria-label="닫기">
                닫기
              </button>
            </div>
            <p>
              <strong>조직명:</strong> {selected.application.organizationName}
            </p>
            <p>
              <strong>담당자:</strong> {selected.application.contactName}
            </p>
            <p>
              <strong>연락처:</strong> {selected.application.contactPhone}
            </p>
            <p>
              <strong>신청 유형:</strong>{" "}
              {selected.application.requestedClientType === "REGISTERED" ? "연회원 신청" : "일반"}
            </p>
            <p>
              <strong>신청자:</strong> {selected.userDisplayName ?? "-"}
            </p>
            <p>
              <strong>현재 상태:</strong> {statusLabel(selected.application.status)}
            </p>
            <p>
              <strong>신청일:</strong> {formatTableDate(selected.application.createdAt)}
            </p>
            <p>
              <strong>검토일시:</strong>{" "}
              {selected.application.reviewedAt ? formatTableDate(selected.application.reviewedAt) : "-"}
            </p>
            <p>
              <strong>검토자 ID:</strong> {selected.application.reviewedByUserId ?? "-"}
            </p>
            <p>
              <strong>거절 사유:</strong> {selected.application.rejectedReason ?? "-"}
            </p>

            <ApplicationStatusUpdateForm
              applicationId={selected.application.id}
              initialStatus={selected.application.status}
              initialRejectedReason={selected.application.rejectedReason ?? ""}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
