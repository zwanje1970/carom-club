"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKoreanDateTime } from "@/lib/format-date";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import { ConsoleActionBar } from "@/components/client/console/ui/ConsoleActionBar";

type TournamentOption = {
  id: string;
  name: string;
  status: string;
  startAt: string;
};

type RecipientRow = {
  userId: string;
  name: string;
  phone: string | null;
  pushEnabled: boolean;
  tournaments: { id: string; name: string }[];
  tournamentCount: number;
  recentParticipationAt: string;
};

type EntryStatus = "APPLIED" | "CONFIRMED" | "REJECTED" | "CANCELED";

const STATUS_OPTIONS: { value: EntryStatus; label: string }[] = [
  { value: "CONFIRMED", label: "확정 참가자" },
  { value: "APPLIED", label: "신청자" },
  { value: "REJECTED", label: "반려" },
  { value: "CANCELED", label: "취소" },
];

export function ClientPushBroadcastPanel({
  tournaments,
}: {
  tournaments: TournamentOption[];
}) {
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<string[]>([]);
  const [status, setStatus] = useState<EntryStatus>("CONFIRMED");
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      selectedTournamentIds.forEach((id) => params.append("tournamentId", id));
      const res = await fetch(`/api/client/push/recipients?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "수신자 목록을 불러오지 못했습니다.");
        setRows([]);
        return;
      }
      setRows((data as { recipients?: RecipientRow[] }).recipients ?? []);
      setSelectedUserIds(new Set());
    } catch {
      setError("수신자 목록 조회 중 네트워크 오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTournamentIds, status]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const tournamentNames = row.tournaments.map((t) => t.name).join(" ").toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        (row.phone ?? "").toLowerCase().includes(q) ||
        tournamentNames.includes(q)
      );
    });
  }, [rows, search]);

  const selectedCount = selectedUserIds.size;
  const selectableCount = visibleRows.length;
  const selectedPushEnabledCount = useMemo(
    () => visibleRows.filter((row) => selectedUserIds.has(row.userId) && row.pushEnabled).length,
    [selectedUserIds, visibleRows]
  );

  function toggleTournament(id: string) {
    setSelectedTournamentIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function toggleRow(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAllVisible() {
    const everySelected =
      visibleRows.length > 0 && visibleRows.every((row) => selectedUserIds.has(row.userId));
    if (everySelected) {
      setSelectedUserIds(new Set());
      return;
    }
    setSelectedUserIds(new Set(visibleRows.map((row) => row.userId)));
  }

  async function handleSend() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!trimmedBody) {
      setError("내용을 입력해 주세요.");
      return;
    }
    if (selectedCount === 0) {
      setError("발송 대상을 선택해 주세요.");
      return;
    }

    const selectedRows = rows.filter((row) => selectedUserIds.has(row.userId));
    if (
      !confirm(
        `선택 ${selectedRows.length}명 중 ${selectedPushEnabledCount}명에게 실제 푸시가 전송됩니다.\n\n발송하시겠습니까?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/client/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedUserIds: [...selectedUserIds],
          selectedTournamentIds,
          title: trimmedTitle,
          body: trimmedBody,
          url: trimmedUrl || `/client/operations/push`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "웹푸시 발송에 실패했습니다.");
        return;
      }
      const result = data as { audienceCount: number; sent: number; failed: number };
      setNotice(
        `발송 대상 ${result.audienceCount}명, 전송 성공 ${result.sent}건, 실패 ${result.failed}건`
      );
      setSelectedUserIds(new Set());
      setTitle("");
      setBody("");
      setUrl("");
    } catch {
      setError("웹푸시 발송 중 네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
          {notice}
        </p>
      )}

      <ConsoleSection title="대회 필터">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTournamentIds([])}
              className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
                selectedTournamentIds.length === 0
                  ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              }`}
            >
              전체 대회
            </button>
            {tournaments.map((tournament) => {
              const active = selectedTournamentIds.includes(tournament.id);
              return (
                <button
                  key={tournament.id}
                  type="button"
                  onClick={() => toggleTournament(tournament.id)}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                  }`}
                >
                  {tournament.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">참가 상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EntryStatus)}
              className="rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 / 번호 / 대회명 검색"
              className="min-w-[14rem] flex-1 rounded-sm border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => void loadRecipients()}
              className="rounded-sm border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              새로고침
            </button>
          </div>
        </div>
      </ConsoleSection>

      <ConsoleSection title="수신자 선택">
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">조건에 맞는 수신자가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                조회 {visibleRows.length}명 · 선택 {selectedCount}명 · 푸시 가능 선택 {selectedPushEnabledCount}명
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={visibleRows.length > 0 && visibleRows.every((row) => selectedUserIds.has(row.userId))}
                  onChange={toggleAllVisible}
                  className="rounded border-zinc-400"
                />
                전체선택
              </label>
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60">
                  <tr>
                    <th className="px-3 py-2 text-left">선택</th>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-left">전화번호</th>
                    <th className="px-3 py-2 text-left">푸시</th>
                    <th className="px-3 py-2 text-left">참가 대회</th>
                    <th className="px-3 py-2 text-left">대회 수</th>
                    <th className="px-3 py-2 text-left">최근 참가일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {visibleRows.map((row) => (
                    <tr key={row.userId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(row.userId)}
                          onChange={() => toggleRow(row.userId)}
                          className="rounded border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{row.name}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            row.pushEnabled
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {row.pushEnabled ? "가능" : "미구독"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {row.tournaments.map((tournament) => tournament.name).join(", ")}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{row.tournamentCount}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {formatKoreanDateTime(row.recentParticipationAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ConsoleSection>

      <ConsoleSection title="발송">
        <div className="space-y-3">
          {selectedCount > 0 && (
            <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              선택 {selectedCount}명 중 푸시 수신 가능 {selectedPushEnabledCount}명에게만 실제 발송됩니다.
            </p>
          )}
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">제목</span>
              <input
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 대회 안내 공지"
                className="w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">이동 경로</span>
              <input
                type="text"
                maxLength={300}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/client/operations/push"
                className="w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
          </div>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">내용</span>
            <textarea
              maxLength={200}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="예: 경기 시작 30분 전까지 도착해 주세요."
              className="w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
        </div>
      </ConsoleSection>

      <ConsoleActionBar
        left={
          <span>
            표시 대상 <strong>{selectableCount}</strong>명 / 선택 <strong>{selectedCount}</strong>명
          </span>
        }
        right={
          <button
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={() => void handleSend()}
            className="rounded-sm border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
          >
            {busy ? "발송 중..." : "선택 대상에게 웹푸시 발송"}
          </button>
        }
      />
    </div>
  );
}
