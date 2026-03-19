"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { FeeLedgerData, FeeLedgerRow, PaymentRecord } from "./types";
import FeeLedgerModal from "../venues/FeeLedgerModal";
import { formatKoreanDate } from "@/lib/format-date";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "정상",
  SUSPENDED: "정지",
  EXPELLED: "제명",
};

const FEE_TYPE_LABELS: Record<string, string> = {
  MONTHLY: "월회비",
  ANNUAL: "연회비",
};

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

type Props = { initialData: FeeLedgerData };

export default function FeeLedgerPageClient({ initialData }: Props) {
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

  const formatDate = (iso: string | null): string => (iso ? formatKoreanDate(iso) : "-");

  function downloadExcel() {
    const headers = [
      "당구장",
      "상태",
      "회비유형",
      "권장금액",
      "최근 납부기간",
      "최근 입금일",
      "이번달 상태",
      "미납개월",
      "총 입금",
      "비고",
    ];
    const rows = sorted.map((r) => [
      r.name,
      STATUS_LABELS[r.status] ?? r.status,
      r.feeType ? FEE_TYPE_LABELS[r.feeType] ?? r.feeType : "-",
      r.amountInWon != null ? String(r.amountInWon) : "-",
      r.latestPeriod ?? "-",
      r.latestPaidAt ? formatKoreanDate(r.latestPaidAt) : "-",
      r.thisMonthStatus,
      r.monthsArrears != null ? String(r.monthsArrears) : "-",
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">전체 업체</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {summary.totalOrgs}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">이번 달 납부</p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
            {summary.paidThisMonth}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">미납 업체</p>
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {summary.arrearsCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">총 입금액</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {summary.totalAmount.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 2. 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="업체명·비고 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={arrearsOnly}
            onChange={(e) => setArrearsOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          미납만
        </label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="name">당구장순</option>
          <option value="status">상태순</option>
          <option value="thisMonthStatus">이번달 상태순</option>
          <option value="monthsArrears">미납개월순</option>
          <option value="latestPaidAt">최근 입금일순</option>
          <option value="totalPaid">총 입금순</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {sortDir === "asc" ? "↑ 오름차순" : "↓ 내림차순"}
        </button>
        <button
          type="button"
          onClick={downloadExcel}
          className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
        >
          엑셀 다운로드
        </button>
        <button
          type="button"
          onClick={() => setPaymentOrgSelect(true)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          입금 등록
        </button>
      </div>

      {/* 탭: 전체 장부 | 월별 장부 | 입금 내역 */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "ledger"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          전체 장부
        </button>
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "monthly"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          월별 장부 보기
        </button>
        <button
          type="button"
          onClick={() => setTab("payments")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "payments"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-slate-400"
          }`}
        >
          입금 내역
        </button>
      </div>

      {/* 3. 전체 장부 테이블 */}
      {tab === "ledger" && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  당구장
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  상태
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  회비유형
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  권장금액
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  최근 납부기간
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  최근 입금일
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  이번달 상태
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  미납개월
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  총 입금
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400 max-w-[120px]">
                  비고
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    조건에 맞는 데이터가 없습니다.
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
                      {STATUS_LABELS[r.status] ?? r.status}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.feeType ? FEE_TYPE_LABELS[r.feeType] ?? r.feeType : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                      {r.amountInWon != null ? r.amountInWon.toLocaleString() : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.latestPeriod ?? "-"}
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
                      {r.monthsArrears != null ? r.monthsArrears : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-right text-gray-600 dark:text-slate-400">
                      {r.totalPaid.toLocaleString()}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 text-sm text-gray-600 dark:text-slate-400">
                      {r.adminRemarks || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setModalOrg({ id: r.id, name: r.name })}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        회비 장부
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. 월별 장부 보기 */}
      {tab === "monthly" && (
        <MonthlyLedgerView rows={sorted} formatDate={formatDate} onOpenModal={setModalOrg} />
      )}

      {/* 5. 입금 내역 탭 */}
      {tab === "payments" && (
        <PaymentHistoryTab payments={initialData.payments} formatDate={formatDate} />
      )}

      {/* 업체 선택 후 입금 등록 (모달 열기) */}
      {paymentOrgSelect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 dark:bg-slate-800">
            <h3 className="mb-3 text-lg font-semibold">입금 등록 — 업체 선택</h3>
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
                취소
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
}: {
  rows: FeeLedgerRow[];
  formatDate: (iso: string | null) => string;
  onOpenModal: (org: { id: string; name: string }) => void;
}) {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRows = rows.filter((r) => r.feeType === "MONTHLY");
  const thisMonthPaid = monthlyRows.filter((r) => r.thisMonthStatus === "납부완료");
  const thisMonthUnpaid = monthlyRows.filter((r) => r.thisMonthStatus === "미납");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-slate-400">
        기준: {currentPeriod} (월회비 업체만 표시)
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                당구장
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                이번달 상태
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                최근 입금일
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                상세
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
                    회비 장부
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentHistoryTab({
  payments,
  formatDate,
}: {
  payments: PaymentRecord[];
  formatDate: (iso: string) => string;
}) {
  const displayPayments = payments.slice(0, 200);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              입금일
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              업체
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              기간
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              금액(원)
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
              비고
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
          {displayPayments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                입금 내역이 없습니다.
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
                  {p.memo ?? "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {payments.length > 200 && (
        <p className="mt-2 text-xs text-gray-500">최근 200건만 표시됩니다.</p>
      )}
    </div>
  );
}
