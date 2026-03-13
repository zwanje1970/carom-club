"use client";

import { useState, useEffect, useCallback } from "react";

type FeeSetting = { id: string; feeType: string; amountInWon: number | null } | null;
type Payment = { id: string; amountInWon: number; paidAt: string; period: string; memo: string | null };

type Props = {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
};

export default function FeeLedgerModal({ organizationId, organizationName, onClose }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feeType, setFeeType] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [amountInWon, setAmountInWon] = useState<string>("");
  const [newAmount, setNewAmount] = useState("");
  const [newPaidAt, setNewPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [newPeriod, setNewPeriod] = useState("");
  const [newMemo, setNewMemo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/fee`, { credentials: "include" });
      const data = (await res.json()) as {
        feeSetting?: FeeSetting;
        payments?: Payment[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setPayments(data.payments ?? []);
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      if (data.feeSetting) {
        setFeeType(data.feeSetting.feeType === "ANNUAL" ? "ANNUAL" : "MONTHLY");
        setAmountInWon(data.feeSetting.amountInWon != null ? String(data.feeSetting.amountInWon) : "");
        setNewPeriod(data.feeSetting.feeType === "ANNUAL" ? String(y) : `${y}-${m}`);
      } else {
        setNewPeriod(`${y}-${m}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (feeType === "ANNUAL" && !newPeriod) setNewPeriod(String(new Date().getFullYear()));
    if (feeType === "MONTHLY" && !newPeriod) {
      const d = new Date();
      setNewPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [feeType, newPeriod]);

  async function saveSetting() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          feeType,
          amountInWon: amountInWon === "" ? null : parseInt(amountInWon, 10) || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function addPayment() {
    const amount = parseInt(newAmount, 10);
    if (isNaN(amount) || amount < 0) {
      alert("입금액을 입력해 주세요.");
      return;
    }
    const period = newPeriod.trim();
    if (!period) {
      alert("기간을 입력해 주세요. 월회비: 2025-01, 연회비: 2025");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/fee/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountInWon: amount,
          paidAt: newPaidAt || new Date().toISOString().slice(0, 10),
          period,
          memo: newMemo.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewAmount("");
      setNewMemo("");
      setNewPaidAt(new Date().toISOString().slice(0, 10));
      const d = new Date();
      setNewPeriod(feeType === "ANNUAL" ? String(d.getFullYear()) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      await load();
    } catch (e) {
      console.error(e);
      alert("입력에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-4 dark:bg-slate-800">
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-ledger-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
          <h2 id="fee-ledger-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            회비 장부 — {organizationName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:text-slate-400 dark:hover:bg-slate-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(90vh - 120px)" }}>
          {/* 회비 유형 설정 */}
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">회비 유형</h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feeType"
                  checked={feeType === "MONTHLY"}
                  onChange={() => setFeeType("MONTHLY")}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">월회비</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feeType"
                  checked={feeType === "ANNUAL"}
                  onChange={() => setFeeType("ANNUAL")}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">연회비</span>
              </label>
              <input
                type="number"
                min={0}
                placeholder="권장 금액 (원)"
                value={amountInWon}
                onChange={(e) => setAmountInWon(e.target.value)}
                className="w-32 rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={saveSetting}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </section>

          {/* 입금 내역 추가 */}
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">입금 등록</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-gray-500">입금액(원)</label>
                <input
                  type="number"
                  min={0}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">입금일</label>
                <input
                  type="date"
                  value={newPaidAt}
                  onChange={(e) => setNewPaidAt(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">
                  기간 ({feeType === "ANNUAL" ? "연도 2025" : "월 2025-01"})
                </label>
                <input
                  type="text"
                  placeholder={feeType === "ANNUAL" ? "2025" : "2025-01"}
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="min-w-[120px]">
                <label className="block text-xs text-gray-500">비고</label>
                <input
                  type="text"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={addPayment}
                disabled={saving}
                className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </section>

          {/* 입금 목록 */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">입금 내역</h3>
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-slate-600">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">입금일</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">기간</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-slate-400">금액(원)</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                        입금 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="text-gray-700 dark:text-slate-300">
                        <td className="whitespace-nowrap px-3 py-2">
                          {new Date(p.paidAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{p.period}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {p.amountInWon.toLocaleString()}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2">{p.memo ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
