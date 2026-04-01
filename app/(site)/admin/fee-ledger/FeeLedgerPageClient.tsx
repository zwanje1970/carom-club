"use client";

import Link from "next/link";
import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { FeeLedgerData, FeeLedgerRow, PaymentRecord } from "./types";
import FeeLedgerModal from "../venues/FeeLedgerModal";
import { formatKoreanDate } from "@/lib/format-date";
import {
  fillAdminCopyTemplate,
  getCopyValue,
  getFeeLedgerFeeTypeLabel,
  getVenueOrgStatusLabel,
} from "@/lib/admin-copy";

type SortKey =
  | "name"
  | "status"
  | "feeType"
  | "amountInWon"
  | "latestPeriod"
  | "latestPaidAt"
  | "thisMonthStatus"
  | "monthsArrears"
  | "totalPaid"
  | "adminRemarks";

type Props = { initialData: FeeLedgerData; copy: Record<string, string> };

function FeeLedgerToolbar({
  copy,
  search,
  setSearch,
  arrearsOnly,
  setArrearsOnly,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  downloadExcel,
  setPaymentOrgSelect,
}: {
  copy: Record<string, string>;
  search: string;
  setSearch: (s: string) => void;
  arrearsOnly: boolean;
  setArrearsOnly: (v: boolean) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  sortDir: "asc" | "desc";
  setSortDir: Dispatch<SetStateAction<"asc" | "desc">>;
  downloadExcel: () => void;
  setPaymentOrgSelect: (v: boolean) => void;
}) {
  const field =
    "min-h-[44px] w-full rounded border border-gray-300 px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:min-h-0 md:w-auto md:py-1.5 md:text-sm";
  const selectClass =
    "min-h-[44px] w-full rounded border border-gray-300 px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:min-h-0 md:w-auto md:py-1.5 md:text-sm";
  const btnClass =
    "min-h-[44px] w-full touch-manipulation rounded border border-gray-300 px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:min-h-0 md:w-auto md:py-1.5 md:text-sm";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <input
        type="text"
        placeholder={getCopyValue(copy, "admin.feeLedger.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={field}
        aria-label={getCopyValue(copy, "admin.feeLedger.searchPlaceholder")}
      />
      <label className="flex min-h-[44px] items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={arrearsOnly}
          onChange={(e) => setArrearsOnly(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300"
        />
        {getCopyValue(copy, "admin.feeLedger.filterArrearsOnly")}
      </label>
      <select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value as SortKey)}
        className={selectClass}
        aria-label={getCopyValue(copy, "admin.list.sortLabel")}
      >
        <option value="name">{getCopyValue(copy, "admin.feeLedger.sortName")}</option>
        <option value="status">{getCopyValue(copy, "admin.feeLedger.sortStatus")}</option>
        <option value="thisMonthStatus">{getCopyValue(copy, "admin.feeLedger.sortThisMonthStatus")}</option>
        <option value="monthsArrears">{getCopyValue(copy, "admin.feeLedger.sortMonthsArrears")}</option>
        <option value="latestPaidAt">{getCopyValue(copy, "admin.feeLedger.sortLatestPaidAt")}</option>
        <option value="totalPaid">{getCopyValue(copy, "admin.feeLedger.sortTotalPaid")}</option>
        <option value="feeType">{getCopyValue(copy, "admin.feeLedger.sortFeeType")}</option>
        <option value="amountInWon">{getCopyValue(copy, "admin.feeLedger.sortAmount")}</option>
        <option value="latestPeriod">{getCopyValue(copy, "admin.feeLedger.sortLatestPeriod")}</option>
        <option value="adminRemarks">{getCopyValue(copy, "admin.feeLedger.sortAdminRemarks")}</option>
      </select>
      <button type="button" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className={btnClass}>
        {sortDir === "asc"
          ? getCopyValue(copy, "admin.feeLedger.sortDirAsc")
          : getCopyValue(copy, "admin.feeLedger.sortDirDesc")}
      </button>
      <button
        type="button"
        onClick={downloadExcel}
        className="min-h-[44px] w-full rounded bg-green-600 px-3 py-2.5 text-base font-medium text-white hover:bg-green-700 md:min-h-0 md:w-auto md:py-1.5 md:text-sm"
      >
        {getCopyValue(copy, "admin.feeLedger.btnExcel")}
      </button>
      <button
        type="button"
        onClick={() => setPaymentOrgSelect(true)}
        className="min-h-[44px] w-full rounded bg-blue-600 px-3 py-2.5 text-base font-medium text-white hover:bg-blue-700 md:min-h-0 md:w-auto md:py-1.5 md:text-sm"
      >
        {getCopyValue(copy, "admin.feeLedger.btnPaymentRegister")}
      </button>
    </div>
  );
}

export default function FeeLedgerPageClient({ initialData, copy }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [arrearsOnly, setArrearsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tab, setTab] = useState<"ledger" | "monthly" | "payments">("ledger");
  const [modalOrg, setModalOrg] = useState<{ id: string; name: string } | null>(null);
  const [paymentOrgSelect, setPaymentOrgSelect] = useState(false);

  const filtered = useMemo(() => {
    let list = initialData.rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.adminRemarks ?? "").toLowerCase().includes(q)
      );
    }
    if (arrearsOnly) {
      list = list.filter((r) => (r.monthsArrears ?? 0) > 0 || r.thisMonthStatus === "미납");
    }
    return list;
  }, [initialData.rows, search, arrearsOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va: string | number | null = (a as Record<string, unknown>)[sortKey] as string | number | null;
      const vb: string | number | null = (b as Record<string, unknown>)[sortKey] as string | number | null;
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === "asc" ? 1 : -1;
      if (vb == null) return sortDir === "asc" ? -1 : 1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const dash = getCopyValue(copy, "admin.list.datePlaceholder");

  const formatDate = (iso: string | null): string => (iso ? formatKoreanDate(iso) : dash);

  function downloadExcel() {
    const headers = [
      getCopyValue(copy, "admin.feeLedger.thBilliardHall"),
      getCopyValue(copy, "admin.list.thStatus"),
      getCopyValue(copy, "admin.feeLedger.thFeeType"),
      getCopyValue(copy, "admin.feeLedger.thRecommendedAmount"),
      getCopyValue(copy, "admin.feeLedger.thLatestPeriod"),
      getCopyValue(copy, "admin.feeLedger.thLatestPaidAt"),
      getCopyValue(copy, "admin.feeLedger.thThisMonthStatus"),
      getCopyValue(copy, "admin.feeLedger.thMonthsArrears"),
      getCopyValue(copy, "admin.feeLedger.thTotalPaid"),
      getCopyValue(copy, "admin.feeLedger.thRemarks"),
    ];
    const rows = sorted.map((r) => [
      r.name,
      getVenueOrgStatusLabel(copy, r.status),
      r.feeType ? getFeeLedgerFeeTypeLabel(copy, r.feeType) : dash,
      r.amountInWon != null ? String(r.amountInWon) : dash,
      r.latestPeriod ?? dash,
      r.latestPaidAt ? formatKoreanDate(r.latestPaidAt) : dash,
      r.thisMonthStatus,
      r.monthsArrears != null ? String(r.monthsArrears) : dash,
      String(r.totalPaid),
      r.adminRemarks ?? "",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fee-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = initialData.summary;

  return (
    <div className="space-y-4">
      {/* 1. 상단 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
            {getCopyValue(copy, "admin.feeLedger.summaryTotalOrgsLabel")}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {summary.totalOrgs}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
            {getCopyValue(copy, "admin.feeLedger.summaryPaidThisMonthLabel")}
          </p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
            {summary.paidThisMonth}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
            {getCopyValue(copy, "admin.feeLedger.summaryArrearsOrgsLabel")}
          </p>
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {summary.arrearsCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
            {getCopyValue(copy, "admin.feeLedger.summaryTotalAmountLabel")}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {summary.totalAmount.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 2. 필터 바 — 모바일: 접기 */}
      <details className="rounded-lg border border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-800/40 md:hidden">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-900 outline-none dark:text-slate-100 [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-blue-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-800">
          <span className="min-w-0 flex-1">{getCopyValue(copy, "admin.list.searchAria")}</span>
          <span className="text-gray-500" aria-hidden>
            ▼
          </span>
        </summary>
        <div className="border-t border-gray-200 p-4 dark:border-slate-600">
          <FeeLedgerToolbar
            copy={copy}
            search={search}
            setSearch={setSearch}
            arrearsOnly={arrearsOnly}
            setArrearsOnly={setArrearsOnly}
            sortKey={sortKey}
            setSortKey={setSortKey}
            sortDir={sortDir}
            setSortDir={setSortDir}
            downloadExcel={downloadExcel}
            setPaymentOrgSelect={setPaymentOrgSelect}
          />
        </div>
      </details>
      <div className="hidden md:block">
        <FeeLedgerToolbar
          copy={copy}
          search={search}
          setSearch={setSearch}
          arrearsOnly={arrearsOnly}
          setArrearsOnly={setArrearsOnly}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          downloadExcel={downloadExcel}
          setPaymentOrgSelect={setPaymentOrgSelect}
        />
      </div>

      {/* 탭: 전체 장부 | 월별 장부 | 입금 내역 */}
      <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-gray-200 pb-px dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`shrink-0 rounded-t border-b-2 px-3 py-3 text-sm font-medium outline-none md:py-2 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 ${
            tab === "ledger"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          {getCopyValue(copy, "admin.feeLedger.tabLedger")}
        </button>
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`shrink-0 rounded-t border-b-2 px-3 py-3 text-sm font-medium outline-none md:py-2 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 ${
            tab === "monthly"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          {getCopyValue(copy, "admin.feeLedger.tabMonthly")}
        </button>
        <button
          type="button"
          onClick={() => setTab("payments")}
          className={`shrink-0 rounded-t border-b-2 px-3 py-3 text-sm font-medium outline-none md:py-2 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 ${
            tab === "payments"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          {getCopyValue(copy, "admin.feeLedger.tabPayments")}
        </button>
      </div>

      {/* 3. 전체 장부 테이블 */}
      {tab === "ledger" && (
        <>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thBilliardHall")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.list.thStatus")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thFeeType")}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thRecommendedAmount")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thLatestPeriod")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thLatestPaidAt")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thThisMonthStatus")}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thMonthsArrears")}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thTotalPaid")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400 max-w-[120px]">
                  {getCopyValue(copy, "admin.feeLedger.thRemarks")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  {getCopyValue(copy, "admin.feeLedger.thDetail")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    {getCopyValue(copy, "admin.list.emptyFiltered")}
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                      <Link
                        href={`/admin/venues/${r.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {getVenueOrgStatusLabel(copy, r.status)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.feeType ? getFeeLedgerFeeTypeLabel(copy, r.feeType) : dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                      {r.amountInWon != null ? r.amountInWon.toLocaleString() : dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.latestPeriod ?? dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {formatDate(r.latestPaidAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      <span
                        className={
                          r.thisMonthStatus === "납부완료"
                            ? "text-green-600 dark:text-green-400"
                            : r.thisMonthStatus === "미납"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-500 dark:text-slate-500"
                        }
                      >
                        {r.thisMonthStatus}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                      {r.monthsArrears != null ? r.monthsArrears : dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                      {r.totalPaid.toLocaleString()}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.adminRemarks || dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setModalOrg({ id: r.id, name: r.name })}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {getCopyValue(copy, "admin.feeLedger.rowOpenLedger")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {sorted.length === 0 ? (
            <p className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-slate-600 dark:text-slate-400">
              {getCopyValue(copy, "admin.list.emptyFiltered")}
            </p>
          ) : (
            sorted.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/admin/venues/${r.id}`}
                    className="break-words text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.name}
                  </Link>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {getVenueOrgStatusLabel(copy, r.status)}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-gray-600 dark:text-slate-400">
                  <div className="flex justify-between gap-2">
                    <dt>{getCopyValue(copy, "admin.feeLedger.thFeeType")}</dt>
                    <dd>{r.feeType ? getFeeLedgerFeeTypeLabel(copy, r.feeType) : dash}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{getCopyValue(copy, "admin.feeLedger.thThisMonthStatus")}</dt>
                    <dd
                      className={
                        r.thisMonthStatus === "납부완료"
                          ? "font-medium text-green-600 dark:text-green-400"
                          : r.thisMonthStatus === "미납"
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : ""
                      }
                    >
                      {r.thisMonthStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{getCopyValue(copy, "admin.feeLedger.thMonthsArrears")}</dt>
                    <dd>{r.monthsArrears != null ? r.monthsArrears : dash}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{getCopyValue(copy, "admin.feeLedger.thTotalPaid")}</dt>
                    <dd>{r.totalPaid.toLocaleString()}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setModalOrg({ id: r.id, name: r.name })}
                  className="mt-4 min-h-[44px] w-full touch-manipulation rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  {getCopyValue(copy, "admin.feeLedger.rowOpenLedger")}
                </button>
              </div>
            ))
          )}
        </div>
        </>
      )}

      {/* 4. 월별 장부 보기 */}
      {tab === "monthly" && (
        <MonthlyLedgerView
          rows={sorted}
          formatDate={formatDate}
          onOpenModal={setModalOrg}
          copy={copy}
        />
      )}

      {/* 5. 입금 내역 탭 */}
      {tab === "payments" && (
        <PaymentHistoryTab payments={initialData.payments} formatDate={formatDate} copy={copy} />
      )}

      {/* 업체 선택 후 입금 등록 (모달 열기) */}
      {paymentOrgSelect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 dark:bg-slate-800">
            <h3 className="mb-3 text-lg font-semibold">{getCopyValue(copy, "admin.feeLedger.paymentSelectTitle")}</h3>
            <ul className="max-h-80 overflow-y-auto rounded border border-gray-200 dark:border-slate-600">
              {initialData.rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOrgSelect(false);
                      setModalOrg({ id: r.id, name: r.name });
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setPaymentOrgSelect(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                {getCopyValue(copy, "admin.common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOrg && (
        <FeeLedgerModal
          organizationId={modalOrg.id}
          organizationName={modalOrg.name}
          onClose={() => {
            setModalOrg(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MonthlyLedgerView({
  rows,
  formatDate,
  onOpenModal,
  copy,
}: {
  rows: FeeLedgerRow[];
  formatDate: (iso: string | null) => string;
  onOpenModal: (org: { id: string; name: string }) => void;
  copy: Record<string, string>;
}) {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRows = rows.filter((r) => r.feeType === "MONTHLY");
  const thisMonthPaid = monthlyRows.filter((r) => r.thisMonthStatus === "납부완료");
  const thisMonthUnpaid = monthlyRows.filter((r) => r.thisMonthStatus === "미납");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-slate-400">
        {fillAdminCopyTemplate(getCopyValue(copy, "admin.feeLedger.monthlyBasisHint"), { period: currentPeriod })}
      </p>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.feeLedger.thBilliardHall")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.feeLedger.thThisMonthStatus")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.feeLedger.thLatestPaidAt")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                {getCopyValue(copy, "admin.feeLedger.thDetail")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {[...thisMonthPaid, ...thisMonthUnpaid].map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                  <Link
                    href={`/admin/venues/${r.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm">
                  <span
                    className={
                      r.thisMonthStatus === "납부완료"
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {r.thisMonthStatus}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                  {formatDate(r.latestPaidAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenModal({ id: r.id, name: r.name })}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {getCopyValue(copy, "admin.feeLedger.rowOpenLedger")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {[...thisMonthPaid, ...thisMonthUnpaid].map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/50"
          >
            <Link
              href={`/admin/venues/${r.id}`}
              className="break-words text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {r.name}
            </Link>
            <p className="mt-2 text-sm">
              <span className="text-gray-500 dark:text-slate-400">{getCopyValue(copy, "admin.feeLedger.thThisMonthStatus")}: </span>
              <span
                className={
                  r.thisMonthStatus === "납부완료"
                    ? "font-medium text-green-600 dark:text-green-400"
                    : "font-medium text-amber-600 dark:text-amber-400"
                }
              >
                {r.thisMonthStatus}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thLatestPaidAt")}: {formatDate(r.latestPaidAt)}
            </p>
            <button
              type="button"
              onClick={() => onOpenModal({ id: r.id, name: r.name })}
              className="mt-3 min-h-[44px] w-full touch-manipulation rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
            >
              {getCopyValue(copy, "admin.feeLedger.rowOpenLedger")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentHistoryTab({
  payments,
  formatDate,
  copy,
}: {
  payments: PaymentRecord[];
  formatDate: (iso: string) => string;
  copy: Record<string, string>;
}) {
  const displayPayments = payments.slice(0, 200);

  return (
    <>
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thPaymentDate")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thPaymentOrg")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thPaymentPeriod")}
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thPaymentAmount")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thRemarks")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
          {displayPayments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                {getCopyValue(copy, "admin.feeLedger.paymentsEmpty")}
              </td>
            </tr>
          ) : (
            displayPayments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                  {formatDate(p.paidAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                  <Link
                    href={`/admin/venues/${p.organizationId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {p.organizationName}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                  {p.period}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                  {p.amountInWon.toLocaleString()}
                </td>
                <td className="max-w-[120px] truncate px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                  {p.memo ?? getCopyValue(copy, "admin.list.datePlaceholder")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <div className="space-y-3 md:hidden">
      {displayPayments.length === 0 ? (
        <p className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-slate-600">
          {getCopyValue(copy, "admin.feeLedger.paymentsEmpty")}
        </p>
      ) : (
        displayPayments.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/50"
          >
            <p className="text-sm text-gray-600 dark:text-slate-400">{formatDate(p.paidAt)}</p>
            <Link
              href={`/admin/venues/${p.organizationId}`}
              className="mt-1 block break-words text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {p.organizationName}
            </Link>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
              {getCopyValue(copy, "admin.feeLedger.thPaymentPeriod")}: {p.period}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-slate-100">
              {getCopyValue(copy, "admin.feeLedger.thPaymentAmount")}: {p.amountInWon.toLocaleString()}원
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              {p.memo ?? getCopyValue(copy, "admin.list.datePlaceholder")}
            </p>
          </div>
        ))
      )}
    </div>
    {payments.length > 200 && (
        <p className="mt-2 text-xs text-gray-500">
          {fillAdminCopyTemplate(getCopyValue(copy, "admin.feeLedger.paymentsLimitNote"), { n: 200 })}
        </p>
      )}
    </>
  );
}
