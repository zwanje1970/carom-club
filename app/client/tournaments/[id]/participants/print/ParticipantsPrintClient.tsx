"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type ParticipantsPrintRow = {
  id: string;
  applicantName: string;
  phone: string;
  participantAverage: number | null;
  registrationSource: "admin" | null;
  statusChangedAt: string;
  status: string;
  attendanceChecked: boolean;
};

function groupDraftStorageKey(tournamentId: string): string {
  return `v3-participant-group-draft:${tournamentId.trim()}`;
}

function loadGroupDraftMap(tournamentId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(groupDraftStorageKey(tournamentId));
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (typeof v === "number") out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

function capacityLabel(maxParticipants: number): string {
  const n = Number(maxParticipants);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return String(Math.floor(n));
}

function formatDepositMd(row: ParticipantsPrintRow): string {
  if (row.registrationSource === "admin") return "";
  if (row.status !== "APPROVED") return "";
  const raw = (row.statusChangedAt ?? "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${Number(iso[2])}/${Number(iso[3])}`;
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    /* ignore */
  }
  return "";
}

export default function ParticipantsPrintClient({
  tournamentId,
  tournamentTitle,
  maxParticipants,
  rows,
}: {
  tournamentId: string;
  tournamentTitle: string;
  maxParticipants: number;
  rows: ParticipantsPrintRow[];
}) {
  const router = useRouter();
  const [checkedById, setCheckedById] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const r of rows) {
      o[r.id] = r.attendanceChecked;
    }
    return o;
  });
  const [groupById, setGroupById] = useState<Record<string, string>>({});
  useEffect(() => {
    setGroupById(loadGroupDraftMap(tournamentId));
  }, [tournamentId]);

  const [pending, setPending] = useState<string | null>(null);

  const patchAttendance = useCallback(
    async (entryId: string, checked: boolean) => {
      setPending(entryId);
      try {
        const response = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(entryId)}/attendance`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked }),
          }
        );
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          window.alert(result.error ?? "출석 저장에 실패했습니다.");
          return false;
        }
        return true;
      } catch {
        window.alert("출석 저장 중 오류가 발생했습니다.");
        return false;
      } finally {
        setPending(null);
      }
    },
    [tournamentId]
  );

  async function onToggleAttendance(entryId: string, next: boolean) {
    const prev = checkedById[entryId] ?? false;
    if (prev && !next) {
      if (!window.confirm("출석 체크를 해제할까요?")) return;
    }
    const ok = await patchAttendance(entryId, next);
    if (!ok) return;
    setCheckedById((s) => ({ ...s, [entryId]: next }));
    router.refresh();
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            .participants-print-no-print { display: none !important; }
            .participants-print-wrap { padding: 0 !important; margin: 0 !important; }
            .participants-print-table { font-size: 12pt !important; }
            .participants-print-table th,
            .participants-print-table td { padding: 6px 5px !important; }
          }
          .participants-print-table { width: 100%; border-collapse: collapse; color: #0f172a; }
          .participants-print-table th, .participants-print-table td {
            border: 1px solid #334155;
            padding: 0.35rem 0.3rem;
            text-align: left;
            font-size: 0.88rem;
            vertical-align: middle;
          }
          .participants-print-table th { background: #f1f5f9; font-weight: 800; }
          .participants-print-table tr:nth-child(even) td { background: #fafafa; }
          @media print {
            .participants-print-table th { background: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .participants-print-table tr:nth-child(even) td { background: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `,
        }}
      />
      <main
        className="participants-print-wrap v3-page v3-stack"
        style={{ maxWidth: "56rem", margin: "0 auto", gap: "0.75rem", paddingBottom: "2rem" }}
      >
        <div className="participants-print-no-print v3-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link prefetch={false} href={`/client/tournaments/${tournamentId}`} className="v3-btn" style={{ textDecoration: "none" }}>
            목록으로
          </Link>
          <button type="button" className="v3-btn" onClick={() => window.print()} style={{ fontWeight: 800 }}>
            인쇄
          </button>
        </div>
        <header style={{ borderBottom: "2px solid #0f172a", paddingBottom: "0.5rem" }}>
          <h1 className="v3-h1" style={{ margin: 0, fontSize: "1.25rem" }}>
            참가자 리스트
          </h1>
          <p style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", fontWeight: 800 }}>{tournamentTitle}</p>
          <p className="v3-muted participants-print-no-print" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            참가자 · 이름순 · 조번호는 관리 화면 입력값(임시) 반영 · A4 세로 권장
          </p>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="participants-print-table">
            <thead>
              <tr>
                <th style={{ width: "2.5rem", maxWidth: "40px", textAlign: "center" }}>번호</th>
                <th>이름</th>
                <th style={{ width: "4.5rem", textAlign: "center" }}>점수/에버</th>
                <th>전화번호</th>
                <th style={{ width: "3.5rem", textAlign: "center" }}>입금일</th>
                <th style={{ width: "2.75rem", textAlign: "center" }}>조</th>
                <th style={{ width: "3.5rem", textAlign: "center" }} className="participants-print-att-col">
                  출석
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const checked = checkedById[row.id] ?? false;
                const deposit = formatDepositMd(row);
                const ever =
                  row.participantAverage != null && Number.isFinite(row.participantAverage) ? String(row.participantAverage) : "—";
                const groupVal = (groupById[row.id] ?? "").trim();
                return (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", width: "2.5rem", maxWidth: "40px" }}>
                      {index + 1}
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{row.applicantName}</td>
                    <td style={{ textAlign: "center" }}>{ever}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.phone.trim() || "-"}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{deposit || "-"}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{groupVal || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="participants-print-no-print">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={pending === row.id}
                          onChange={(e) => void onToggleAttendance(row.id, e.target.checked)}
                          style={{ width: "1.2rem", height: "1.2rem", cursor: "pointer" }}
                          aria-label={`${row.applicantName} 출석`}
                        />
                      </span>
                      <span className="participants-print-cb-print" style={{ display: "none" }}>
                        ☐
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              .participants-print-cb-print { display: inline !important; font-size: 12pt; }
            }
          `,
          }}
        />
      </main>
    </>
  );
}
