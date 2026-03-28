"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatKoreanDate } from "@/lib/format-date";
import {
  SETTLEMENT_CATEGORIES,
  SETTLEMENT_CATEGORY_LABEL,
  type SettlementCategory,
  type SettlementFlow,
  computeSettlementTotals,
} from "@/lib/tournament-settlement";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui/ConsoleTable";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextMuted } from "@/components/client/console/ui/tokens";
import { getKstYmd } from "@/lib/kst-date";

const TOURNAMENT_STATUS: Record<string, string> = {
  DRAFT: "임시",
  OPEN: "모집",
  CLOSED: "마감",
  BRACKET_GENERATED: "대진확정",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

type OverviewRow = {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  status: string;
  settlementStatus: string | null;
  income: number;
  expense: number;
  net: number;
};

type DraftLine = {
  key: string;
  category: SettlementCategory;
  flow: SettlementFlow;
  amountKrw: number;
  label: string;
  note: string;
};

function newLine(): DraftLine {
  return {
    key: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: "ENTRY_FEE",
    flow: "INCOME",
    amountKrw: 0,
    label: "",
    note: "",
  };
}

export function ClientBillingSettlementConsole({
  initialTournamentId,
  showPlatformBillingLink,
}: {
  initialTournamentId: string | null;
  showPlatformBillingLink: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialTournamentId);

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 86400000);
    setFrom(getKstYmd(start));
    setTo(getKstYmd(end));
  }, []);

  const loadOverview = useCallback(async () => {
    if (!from || !to) return;
    setError("");
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/client/tournaments/settlements-overview?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "목록을 불러올 수 없습니다.");
        return;
      }
      setRows(data.tournaments ?? []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (initialTournamentId) setSelectedId(initialTournamentId);
  }, [initialTournamentId]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const grand = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      income += r.income;
      expense += r.expense;
    }
    return { income, expense, net: income - expense };
  }, [rows]);

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="정산 관리"
        title="대회 정산"
        description={
          showPlatformBillingLink
            ? "종료 대회의 참가비·환불·상금·비용을 입력하고, 대회별·기간별 순이익을 확인합니다. 플랫폼 구독·결제는 「플랫폼 이용」에서 다룹니다."
            : "종료 대회의 참가비·환불·상금·비용을 입력하고, 대회별·기간별 순이익을 확인합니다."
        }
        actions={
          showPlatformBillingLink ? (
            <Link
              href="/client/billing/platform"
              className="rounded-sm border border-zinc-400 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              플랫폼 이용·구독 →
            </Link>
          ) : undefined
        }
      />

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}

      <ConsoleSection title="필터" plain>
        <div className="flex flex-wrap items-end gap-3 text-[11px]">
          <div>
            <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">시작일(포함)</label>
            <input
              type="date"
              className="border border-zinc-400 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">종료일(포함)</label>
            <input
              type="date"
              className="border border-zinc-400 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadOverview()}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-900 disabled:opacity-50 dark:border-zinc-400 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            조회
          </button>
        </div>
        <p className={cx("text-[10px]", consoleTextMuted)}>
          목록은 대회 시작일이 위 기간에 포함되는 건만 표시합니다.
        </p>
      </ConsoleSection>

      <ConsoleSection title="대회별 요약" flush>
        {loading && rows.length === 0 ? (
          <p className="p-3 text-[11px] text-zinc-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="p-3 text-[11px] text-zinc-500">해당 기간에 대회가 없습니다.</p>
        ) : (
          <ConsoleTable>
            <ConsoleTableHead>
              <ConsoleTableRow>
                <ConsoleTableTh>대회명</ConsoleTableTh>
                <ConsoleTableTh>일정</ConsoleTableTh>
                <ConsoleTableTh>대회 상태</ConsoleTableTh>
                <ConsoleTableTh>정산</ConsoleTableTh>
                <ConsoleTableTh className="text-right">수입</ConsoleTableTh>
                <ConsoleTableTh className="text-right">비용</ConsoleTableTh>
                <ConsoleTableTh className="text-right">순</ConsoleTableTh>
                <ConsoleTableTh className="text-right">작업</ConsoleTableTh>
              </ConsoleTableRow>
            </ConsoleTableHead>
            <ConsoleTableBody>
              {rows.map((r) => (
                <ConsoleTableRow key={r.id}>
                  <ConsoleTableTd className="max-w-[14rem] font-medium">
                    <span className="line-clamp-2">{r.name}</span>
                  </ConsoleTableTd>
                  <ConsoleTableTd className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatKoreanDate(r.startAt)}
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <ConsoleBadge tone="neutral">{TOURNAMENT_STATUS[r.status] ?? r.status}</ConsoleBadge>
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    {r.settlementStatus === "LOCKED" ? (
                      <ConsoleBadge tone="success">잠금</ConsoleBadge>
                    ) : r.settlementStatus === "DRAFT" ? (
                      <ConsoleBadge tone="warning">초안</ConsoleBadge>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[11px]">
                    {r.income.toLocaleString()}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[11px]">
                    {r.expense.toLocaleString()}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[11px] font-semibold">
                    {r.net.toLocaleString()}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="rounded-sm border border-zinc-500 px-2 py-0.5 text-[10px] font-medium hover:bg-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-800"
                    >
                      {selectedId === r.id ? "선택됨" : "편집"}
                    </button>
                  </ConsoleTableTd>
                </ConsoleTableRow>
              ))}
            </ConsoleTableBody>
          </ConsoleTable>
        )}
      </ConsoleSection>

      <ConsoleSection title="기간 합계" plain>
        <div className="border border-zinc-300 text-[11px] dark:border-zinc-600">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <td className="px-2 py-1.5 font-medium">수입 합계</td>
                <td className="px-2 py-1.5 text-right font-mono">{grand.income.toLocaleString()}원</td>
              </tr>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <td className="px-2 py-1.5 font-medium">비용 합계</td>
                <td className="px-2 py-1.5 text-right font-mono">{grand.expense.toLocaleString()}원</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold">순이익</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold">{grand.net.toLocaleString()}원</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ConsoleSection>

      {selectedId && (
        <SettlementDetailPanel
          tournamentId={selectedId}
          summary={selected}
          onSaved={() => void loadOverview()}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function SettlementDetailPanel({
  tournamentId,
  summary,
  onSaved,
  onClose,
}: {
  tournamentId: string;
  summary: OverviewRow | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "LOCKED">("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/settlement`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "불러오기 실패");
        return;
      }
      const s = data.settlement as {
        status: string;
        memo: string | null;
        lines: {
          category: string;
          flow: string;
          amountKrw: number;
          label: string | null;
          note: string | null;
        }[];
      } | null;
      if (s) {
        setMemo(s.memo ?? "");
        setStatus(s.status === "LOCKED" ? "LOCKED" : "DRAFT");
        setLines(
          s.lines.map((L, i) => ({
            key: `l-${i}-${L.category}`,
            category: L.category as SettlementCategory,
            flow: L.flow as SettlementFlow,
            amountKrw: L.amountKrw,
            label: L.label ?? "",
            note: L.note ?? "",
          }))
        );
      } else {
        setMemo("");
        setStatus("DRAFT");
        setLines([]);
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => computeSettlementTotals(lines), [lines]);

  const save = async (nextStatus: "DRAFT" | "LOCKED") => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/settlement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo,
          status: nextStatus,
          lines: lines.map((L, i) => ({
            category: L.category,
            flow: L.flow,
            amountKrw: L.amountKrw,
            label: L.label || null,
            note: L.note || null,
            sortOrder: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장 실패");
        return;
      }
      if (data.settlement) {
        setStatus(data.settlement.status === "LOCKED" ? "LOCKED" : "DRAFT");
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const unlock = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/settlement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "잠금 해제 실패");
        return;
      }
      setStatus("DRAFT");
      await load();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const locked = status === "LOCKED";

  return (
    <ConsoleSection
      title={`정산 편집 · ${summary?.name ?? tournamentId.slice(0, 8)}`}
      description="항목을 추가한 뒤 저장합니다. 잠금 시 더 이상 수정되지 않습니다."
      flush
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-zinc-400 px-2 py-0.5 text-[10px] dark:border-zinc-500"
          >
            닫기
          </button>
          <Link
            href={`/client/tournaments/${tournamentId}`}
            className="rounded-sm border border-zinc-400 px-2 py-0.5 text-[10px] dark:border-zinc-500"
          >
            대회 상세
          </Link>
        </div>
        {locked ? (
          <ConsoleBadge tone="success">잠금됨</ConsoleBadge>
        ) : (
          <ConsoleBadge tone="neutral">편집 가능</ConsoleBadge>
        )}
      </div>

      {error && (
        <p className="mx-2 mt-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] text-red-900 dark:border-red-800 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {loading ? (
        <p className="p-3 text-[11px] text-zinc-500">불러오는 중…</p>
      ) : (
        <>
          <div className="p-2">
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">메모</label>
            <textarea
              className="w-full border border-zinc-400 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
              rows={2}
              disabled={locked}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="정산 참고 사항"
            />
          </div>

          <ConsoleTable>
            <ConsoleTableHead>
              <ConsoleTableRow>
                <ConsoleTableTh>구분</ConsoleTableTh>
                <ConsoleTableTh>유형</ConsoleTableTh>
                <ConsoleTableTh className="text-right">금액(원)</ConsoleTableTh>
                <ConsoleTableTh>라벨</ConsoleTableTh>
                <ConsoleTableTh>비고</ConsoleTableTh>
                <ConsoleTableTh className="w-10" />
              </ConsoleTableRow>
            </ConsoleTableHead>
            <ConsoleTableBody>
              {lines.map((L) => (
                <ConsoleTableRow key={L.key}>
                  <ConsoleTableTd>
                    <select
                      className="w-full border border-zinc-400 bg-white text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
                      disabled={locked}
                      value={L.category}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === L.key ? { ...x, category: e.target.value as SettlementCategory } : x
                          )
                        )
                      }
                    >
                      {SETTLEMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {SETTLEMENT_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <select
                      className="w-full border border-zinc-400 bg-white text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
                      disabled={locked}
                      value={L.flow}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === L.key ? { ...x, flow: e.target.value as SettlementFlow } : x
                          )
                        )
                      }
                    >
                      <option value="INCOME">수입</option>
                      <option value="EXPENSE">비용</option>
                    </select>
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-zinc-400 px-1 py-0.5 text-right font-mono text-[10px] dark:border-zinc-600"
                      disabled={locked}
                      value={L.amountKrw}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === L.key
                              ? { ...x, amountKrw: Math.max(0, parseInt(e.target.value, 10) || 0) }
                              : x
                          )
                        )
                      }
                    />
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <input
                      className="w-full border border-zinc-400 px-1 py-0.5 text-[10px] dark:border-zinc-600"
                      disabled={locked}
                      value={L.label}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) => (x.key === L.key ? { ...x, label: e.target.value } : x))
                        )
                      }
                    />
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <input
                      className="w-full border border-zinc-400 px-1 py-0.5 text-[10px] dark:border-zinc-600"
                      disabled={locked}
                      value={L.note}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) => (x.key === L.key ? { ...x, note: e.target.value } : x))
                        )
                      }
                    />
                  </ConsoleTableTd>
                  <ConsoleTableTd>
                    <button
                      type="button"
                      disabled={locked}
                      className="text-[10px] text-red-700 disabled:opacity-30 dark:text-red-400"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== L.key))}
                    >
                      삭제
                    </button>
                  </ConsoleTableTd>
                </ConsoleTableRow>
              ))}
            </ConsoleTableBody>
          </ConsoleTable>

          <div className="flex flex-wrap gap-2 border-t border-zinc-200 p-2 dark:border-zinc-700">
            <button
              type="button"
              disabled={locked}
              className="rounded border border-zinc-500 px-2 py-1 text-[10px] disabled:opacity-40 dark:border-zinc-500"
              onClick={() => setLines((p) => [...p, newLine()])}
            >
              행 추가
            </button>
            <button
              type="button"
              disabled={saving || locked}
              className="rounded border border-zinc-800 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
              onClick={() => void save("DRAFT")}
            >
              저장
            </button>
            <button
              type="button"
              disabled={saving || locked}
              className="rounded border border-emerald-800 bg-emerald-800 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40"
              onClick={() => void save("LOCKED")}
            >
              저장 후 잠금
            </button>
            {locked && (
              <button
                type="button"
                disabled={saving}
                className="rounded border border-amber-700 px-2 py-1 text-[10px] text-amber-900 dark:border-amber-600 dark:text-amber-100"
                onClick={() => void unlock()}
              >
                잠금 해제
              </button>
            )}
          </div>

          <div className="border-t border-zinc-200 p-2 dark:border-zinc-700">
            <p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-100">편집 중 합계</p>
            <table className="mt-1 w-full text-[11px]">
              <tbody>
                <tr>
                  <td className="text-zinc-600 dark:text-zinc-400">수입</td>
                  <td className="text-right font-mono">{totals.income.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td className="text-zinc-600 dark:text-zinc-400">비용</td>
                  <td className="text-right font-mono">{totals.expense.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td className="font-medium">순</td>
                  <td className="text-right font-mono font-semibold">{totals.net.toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
            <p className={cx("mt-2 text-[10px]", consoleTextMuted)}>
              저장 시 서버에 반영되며, 상단 목록의 수치도 갱신됩니다.
            </p>
          </div>
        </>
      )}
    </ConsoleSection>
  );
}
