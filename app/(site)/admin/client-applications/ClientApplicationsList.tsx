"use client";

import { useCallback, useEffect, useState } from "react";
import { getDisplayName } from "@/lib/display-name";
import { formatKoreanDate } from "@/lib/format-date";
import { DEFAULT_ADMIN_COPY, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

type Row = {
  id: string;
  type: string;
  status: string;
  requestedClientType?: string;
  organizationName: string;
  applicantName: string;
  phone: string;
  email: string;
  region: string | null;
  shortDescription: string | null;
  referenceLink: string | null;
  rejectedReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  applicant: {
    id: string;
    name: string;
    username: string;
    email: string;
    status?: string | null;
    withdrawnAt?: string | null;
  } | null;
};

function appTypeKey(type: string): AdminCopyKey {
  return `admin.clientApplications.type.${type}` as AdminCopyKey;
}

function appStatusKey(status: string): AdminCopyKey {
  return `admin.clientApplications.status.${status}` as AdminCopyKey;
}

function clientTypeKey(t: string): AdminCopyKey {
  return `admin.clientApplications.clientType.${t}` as AdminCopyKey;
}

function getAppTypeLabel(copy: Record<string, string>, type: string): string {
  const k = appTypeKey(type);
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return type;
}

function getAppStatusLabel(copy: Record<string, string>, status: string): string {
  const k = appStatusKey(status);
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return status;
}

function getClientTypeLabel(copy: Record<string, string>, t: string): string {
  const k = clientTypeKey(t);
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return t;
}

type Props = { copy: Record<string, string> };

function ClientApplicationRowActions({
  row,
  copy,
  actioning,
  handleAction,
  withConfirm,
}: {
  row: Row;
  copy: Record<string, string>;
  actioning: string | null;
  handleAction: (
    id: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    rejectedReason?: string | null
  ) => Promise<void>;
  withConfirm: (message: string, onConfirm: () => void) => void;
}) {
  const btn =
    "min-h-[44px] touch-manipulation rounded-lg px-3 text-sm font-medium disabled:opacity-50 md:min-h-0 md:rounded md:px-2 md:py-1 md:text-xs";
  return (
    <span className="flex flex-col gap-2 md:inline-flex md:flex-row md:flex-wrap md:justify-end md:gap-2">
      {row.status === "PENDING" && (
        <>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() =>
              withConfirm(
                row.requestedClientType === "REGISTERED"
                  ? getCopyValue(copy, "admin.clientApplications.confirmApproveRegistered")
                  : getCopyValue(copy, "admin.clientApplications.confirmApproveGeneral"),
                () => handleAction(row.id, "APPROVED")
              )
            }
            className={`${btn} bg-green-600 text-white hover:bg-green-700`}
          >
            {actioning === row.id
              ? getCopyValue(copy, "admin.clientApplications.btnProcessing")
              : getCopyValue(copy, "admin.clientApplications.btnApprove")}
          </button>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() => {
              const reason = window.prompt(getCopyValue(copy, "admin.clientApplications.promptRejectOptional"));
              if (reason !== null)
                withConfirm(getCopyValue(copy, "admin.clientApplications.confirmReject"), () =>
                  handleAction(row.id, "REJECTED", reason)
                );
            }}
            className={`${btn} bg-red-600 text-white hover:bg-red-700`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnReject")}
          </button>
        </>
      )}
      {row.status === "APPROVED" && (
        <>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() =>
              withConfirm(getCopyValue(copy, "admin.clientApplications.confirmCancelApprovePending"), () =>
                handleAction(row.id, "PENDING")
              )
            }
            className={`${btn} bg-gray-500 text-white hover:bg-gray-600`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnRevertToPending")}
          </button>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() => {
              const reason = window.prompt(getCopyValue(copy, "admin.clientApplications.promptReject"));
              if (reason !== null)
                withConfirm(getCopyValue(copy, "admin.clientApplications.confirmCancelApproveRejected"), () =>
                  handleAction(row.id, "REJECTED", reason)
                );
            }}
            className={`${btn} bg-red-600 text-white hover:bg-red-700`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnChangeToRejected")}
          </button>
        </>
      )}
      {row.status === "REJECTED" && (
        <>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() =>
              withConfirm(getCopyValue(copy, "admin.clientApplications.confirmCancelRejectPending"), () =>
                handleAction(row.id, "PENDING")
              )
            }
            className={`${btn} bg-gray-500 text-white hover:bg-gray-600`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnRevertToPending")}
          </button>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() =>
              withConfirm(
                row.requestedClientType === "REGISTERED"
                  ? getCopyValue(copy, "admin.clientApplications.confirmApproveFromRejectedRegistered")
                  : getCopyValue(copy, "admin.clientApplications.confirmApproveFromRejectedGeneral"),
                () => handleAction(row.id, "APPROVED")
              )
            }
            className={`${btn} bg-green-600 text-white hover:bg-green-700`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnChangeToApproved")}
          </button>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() => {
              const newReason = window.prompt(
                getCopyValue(copy, "admin.clientApplications.promptEditReject"),
                row.rejectedReason ?? ""
              );
              if (newReason !== null) handleAction(row.id, "REJECTED", newReason);
            }}
            className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnEditRejectReason")}
          </button>
          <button
            type="button"
            disabled={!!actioning}
            onClick={() =>
              withConfirm(getCopyValue(copy, "admin.clientApplications.confirmDeleteRejectReason"), () =>
                handleAction(row.id, "REJECTED", null)
              )
            }
            className={`${btn} bg-slate-500 text-white hover:bg-slate-600`}
          >
            {getCopyValue(copy, "admin.clientApplications.btnDeleteRejectReason")}
          </button>
        </>
      )}
    </span>
  );
}

export function ClientApplicationsList({ copy }: Props) {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/admin/client-applications");
    if (!res.ok) throw new Error(getCopyValue(copy, "admin.clientApplications.errorListFetch"));
    const data = await res.json();
    setList(data);
  }, [copy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchList();
      } catch {
        if (!cancelled) setError(getCopyValue(copy, "admin.clientApplications.errorListLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchList, copy]);

  async function handleAction(
    id: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    rejectedReason?: string | null
  ) {
    setActioning(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/client-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "REJECTED" && rejectedReason !== undefined
            ? { rejectedReason: rejectedReason?.trim() || null }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || getCopyValue(copy, "admin.clientApplications.errorActionFallback"));
        return;
      }
      try {
        await fetchList();
      } catch {
        setError(getCopyValue(copy, "admin.clientApplications.errorRefetch"));
      }
    } finally {
      setActioning(null);
    }
  }

  function withConfirm(message: string, onConfirm: () => void) {
    if (window.confirm(message)) onConfirm();
  }

  const emptyDash = getCopyValue(copy, "admin.list.emptyDash");

  if (loading) {
    return (
      <p className="text-gray-500" role="status">
        {getCopyValue(copy, "admin.list.loading")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-red-600" role="alert">
        {error}
      </p>
    );
  }
  if (list.length === 0) {
    return (
      <p className="text-gray-500" role="status">
        {getCopyValue(copy, "admin.clientApplications.empty")}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-site-border bg-site-card md:block">
        <table className="w-full text-sm" aria-label={getCopyValue(copy, "admin.clientApplications.pageTitle")}>
          <thead>
            <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.list.thType")}</th>
              <th className="p-3 text-left font-medium">
                {getCopyValue(copy, "admin.clientApplications.thRequestedType")}
              </th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.list.thOrgName")}</th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.clientApplications.thApplicant")}</th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.clientApplications.thContact")}</th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.list.thStatus")}</th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.clientApplications.thCreated")}</th>
              <th className="p-3 text-left font-medium">{getCopyValue(copy, "admin.clientApplications.thRejectReason")}</th>
              <th className="p-3 text-right font-medium">{getCopyValue(copy, "admin.clientApplications.thProcess")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="border-b border-site-border last:border-0">
                <td className="p-3">{getAppTypeLabel(copy, row.type)}</td>
                <td className="p-3">{getClientTypeLabel(copy, row.requestedClientType ?? "GENERAL")}</td>
                <td className="p-3">{row.organizationName}</td>
                <td className="p-3">
                  {getDisplayName(row.applicant) || row.applicantName}
                  {row.applicant && (
                    <span className="ml-1 text-gray-500">({row.applicant.username})</span>
                  )}
                </td>
                <td className="p-3">{row.phone}</td>
                <td className="p-3">
                  <span className="font-medium">{getAppStatusLabel(copy, row.status)}</span>
                </td>
                <td className="p-3">{formatKoreanDate(row.createdAt)}</td>
                <td className="p-3 max-w-[200px]">
                  {row.status === "REJECTED" && (
                    <span className="text-gray-600 dark:text-slate-400">
                      {row.rejectedReason || emptyDash}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <ClientApplicationRowActions
                    row={row}
                    copy={copy}
                    actioning={actioning}
                    handleAction={handleAction}
                    withConfirm={withConfirm}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {list.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-site-border bg-site-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-base font-semibold text-site-text">{row.organizationName}</p>
                <p className="mt-1 text-sm text-site-text-muted">
                  {getAppTypeLabel(copy, row.type)} · {getClientTypeLabel(copy, row.requestedClientType ?? "GENERAL")}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-site-border bg-site-bg px-2.5 py-1 text-xs font-medium text-site-text">
                {getAppStatusLabel(copy, row.status)}
              </span>
            </div>
            <p className="mt-3 text-sm text-site-text">
              {getCopyValue(copy, "admin.clientApplications.thApplicant")}: {getDisplayName(row.applicant) || row.applicantName}
              {row.applicant && (
                <span className="text-site-text-muted"> ({row.applicant.username})</span>
              )}
            </p>
            <p className="mt-1 text-sm text-site-text-muted">
              {getCopyValue(copy, "admin.clientApplications.thContact")}: {row.phone}
            </p>
            <p className="mt-1 text-sm text-site-text-muted">
              {getCopyValue(copy, "admin.clientApplications.thCreated")}: {formatKoreanDate(row.createdAt)}
            </p>
            {row.status === "REJECTED" && (
              <p className="mt-2 text-sm text-site-text-muted">
                {getCopyValue(copy, "admin.clientApplications.thRejectReason")}: {row.rejectedReason || emptyDash}
              </p>
            )}
            <div className="mt-4 border-t border-site-border pt-4">
              <ClientApplicationRowActions
                row={row}
                copy={copy}
                actioning={actioning}
                handleAction={handleAction}
                withConfirm={withConfirm}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
