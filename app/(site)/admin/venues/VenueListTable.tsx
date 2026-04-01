"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ClientListRow } from "./page";
import FeeLedgerModal from "./FeeLedgerModal";
import { formatKoreanDate } from "@/lib/format-date";
import { DEFAULT_ADMIN_COPY, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

function venueTypeKey(type: string): AdminCopyKey {
  return `admin.venues.type.${type}` as AdminCopyKey;
}

function venueStatusKey(status: string): AdminCopyKey {
  return `admin.venues.status.${status}` as AdminCopyKey;
}

function getVenueTypeLabel(copy: Record<string, string>, type: string): string {
  const k = venueTypeKey(type);
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return type;
}

function getVenueStatusLabel(copy: Record<string, string>, status: string): string {
  const k = venueStatusKey(status);
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return status;
}

type Props = { rows: ClientListRow[]; copy: Record<string, string> };

export default function VenueListTable({ rows, copy }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [remarksEdit, setRemarksEdit] = useState<{ id: string; value: string } | null>(null);
  const [feeLedgerOrg, setFeeLedgerOrg] = useState<{ id: string; name: string } | null>(null);

  const typeOptions = useMemo(
    () => [
      { value: "", label: getCopyValue(copy, "admin.list.filter.all") },
      { value: "VENUE", label: getCopyValue(copy, "admin.venues.type.VENUE") },
      { value: "CLUB", label: getCopyValue(copy, "admin.venues.type.CLUB") },
      { value: "FEDERATION", label: getCopyValue(copy, "admin.venues.type.FEDERATION") },
      { value: "INSTRUCTOR", label: getCopyValue(copy, "admin.venues.type.INSTRUCTOR") },
    ],
    [copy]
  );

  const filtered = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  function formatDate(d: Date | string | null): string {
    if (d == null) return getCopyValue(copy, "admin.list.datePlaceholder");
    return formatKoreanDate(d);
  }

  async function updateStatus(orgId: string, status: "ACTIVE" | "SUSPENDED" | "EXPELLED") {
    try {
      const res = await fetch(`/api/admin/venues/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(getCopyValue(copy, "admin.venues.alertActionFailed"));
    }
  }

  async function saveRemarks(orgId: string, value: string) {
    setRemarksEdit(null);
    try {
      const res = await fetch(`/api/admin/venues/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminRemarks: value || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(getCopyValue(copy, "admin.venues.alertPatchFailed"));
    }
  }

  const emptyDash = getCopyValue(copy, "admin.list.emptyDash");

  const filterSelect = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label
        className="text-sm font-medium text-gray-700 dark:text-slate-300"
        htmlFor="venue-type-filter"
      >
        {getCopyValue(copy, "admin.venues.filterTypeLabel")}
      </label>
      <select
        id="venue-type-filter"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        aria-label={getCopyValue(copy, "admin.venues.filterTypeAria")}
        className="min-h-[44px] w-full max-w-md rounded border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:min-h-0 md:w-auto md:py-1.5 md:text-sm"
      >
        {typeOptions.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-800/40 md:hidden">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-900 outline-none dark:text-slate-100 [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-blue-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-800">
          <span className="min-w-0 flex-1">{getCopyValue(copy, "admin.list.searchAria")}</span>
          <span className="text-gray-500" aria-hidden>
            ▼
          </span>
        </summary>
        <div className="border-t border-gray-200 p-4 dark:border-slate-600">{filterSelect}</div>
      </details>
      <div className="hidden md:block">{filterSelect}</div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.list.thType")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.list.thOrgName")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.list.thStatus")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.venues.thApplicationDate")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.venues.thRegisteredDate")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.venues.thSlug")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.venues.thRemarks")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.list.thActions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.venues.empty")}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {getVenueTypeLabel(copy, row.type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                    <Link
                      href={`/admin/venues/${row.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={
                        row.status === "EXPELLED"
                          ? "text-red-600 dark:text-red-400"
                          : row.status === "SUSPENDED"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-600 dark:text-slate-400"
                      }
                    >
                      {getVenueStatusLabel(copy, row.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(row.applicationCreatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400 font-mono">
                    {row.slug}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-sm">
                    {remarksEdit?.id === row.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={remarksEdit.value}
                          onChange={(e) => setRemarksEdit({ id: row.id, value: e.target.value })}
                          onBlur={() => saveRemarks(row.id, remarksEdit.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRemarks(row.id, remarksEdit.value);
                            if (e.key === "Escape") setRemarksEdit(null);
                          }}
                          className="min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                          autoFocus
                          aria-label={getCopyValue(copy, "admin.venues.thRemarks")}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemarksEdit({ id: row.id, value: row.adminRemarks ?? "" })}
                        className="block w-full truncate text-left text-gray-600 hover:underline dark:text-slate-400"
                        title={getCopyValue(copy, "admin.venues.remarksEditTitle")}
                      >
                        {row.adminRemarks || emptyDash}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {row.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "SUSPENDED")}
                          className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          {getCopyValue(copy, "admin.venues.btnSuspend")}
                        </button>
                      )}
                      {row.status === "SUSPENDED" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "ACTIVE")}
                          className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                        >
                          {getCopyValue(copy, "admin.venues.btnRestore")}
                        </button>
                      )}
                      {row.status !== "EXPELLED" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(getCopyValue(copy, "admin.venues.confirmExpel")))
                              updateStatus(row.id, "EXPELLED");
                          }}
                          className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                        >
                          {getCopyValue(copy, "admin.venues.btnExpel")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFeeLedgerOrg({ id: row.id, name: row.name })}
                        className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {getCopyValue(copy, "admin.venues.btnFeeLedger")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-slate-600 dark:text-slate-400">
            {getCopyValue(copy, "admin.venues.empty")}
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/venues/${row.id}`}
                    className="break-words text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{getVenueTypeLabel(copy, row.type)}</p>
                </div>
                <span
                  className={
                    row.status === "EXPELLED"
                      ? "shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : row.status === "SUSPENDED"
                        ? "shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                        : "shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  }
                >
                  {getVenueStatusLabel(copy, row.status)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-slate-400">
                <div className="flex justify-between gap-2">
                  <dt>{getCopyValue(copy, "admin.venues.thApplicationDate")}</dt>
                  <dd className="text-right">{formatDate(row.applicationCreatedAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{getCopyValue(copy, "admin.venues.thRegisteredDate")}</dt>
                  <dd className="text-right">{formatDate(row.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{getCopyValue(copy, "admin.venues.thSlug")}</dt>
                  <dd className="truncate font-mono text-right text-xs">{row.slug}</dd>
                </div>
              </dl>
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-slate-600">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.venues.thRemarks")}
                </p>
                {remarksEdit?.id === row.id ? (
                  <input
                    type="text"
                    value={remarksEdit.value}
                    onChange={(e) => setRemarksEdit({ id: row.id, value: e.target.value })}
                    onBlur={() => saveRemarks(row.id, remarksEdit.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRemarks(row.id, remarksEdit.value);
                      if (e.key === "Escape") setRemarksEdit(null);
                    }}
                    className="mt-1 min-h-[44px] w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    autoFocus
                    aria-label={getCopyValue(copy, "admin.venues.thRemarks")}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setRemarksEdit({ id: row.id, value: row.adminRemarks ?? "" })}
                    className="mt-1 min-h-[44px] w-full rounded border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-600 dark:border-slate-600 dark:text-slate-400"
                    title={getCopyValue(copy, "admin.venues.remarksEditTitle")}
                  >
                    {row.adminRemarks || emptyDash}
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {row.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(row.id, "SUSPENDED")}
                    className="min-h-[44px] touch-manipulation rounded-lg bg-amber-100 px-3 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {getCopyValue(copy, "admin.venues.btnSuspend")}
                  </button>
                )}
                {row.status === "SUSPENDED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(row.id, "ACTIVE")}
                    className="min-h-[44px] touch-manipulation rounded-lg bg-green-100 px-3 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  >
                    {getCopyValue(copy, "admin.venues.btnRestore")}
                  </button>
                )}
                {row.status !== "EXPELLED" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(getCopyValue(copy, "admin.venues.confirmExpel"))) updateStatus(row.id, "EXPELLED");
                    }}
                    className="min-h-[44px] touch-manipulation rounded-lg bg-red-100 px-3 text-sm font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {getCopyValue(copy, "admin.venues.btnExpel")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFeeLedgerOrg({ id: row.id, name: row.name })}
                  className="min-h-[44px] touch-manipulation rounded-lg bg-blue-100 px-3 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {getCopyValue(copy, "admin.venues.btnFeeLedger")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {feeLedgerOrg && (
        <FeeLedgerModal
          organizationId={feeLedgerOrg.id}
          organizationName={feeLedgerOrg.name}
          onClose={() => setFeeLedgerOrg(null)}
        />
      )}
    </div>
  );
}
