"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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

function maskPhoneForScreen(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (!d) return "-";
  if (d.length >= 10) {
    return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
  }
  if (d.length >= 7) {
    return `${d.slice(0, 2)}-****-${d.slice(-3)}`;
  }
  return "****";
}

function depositLabel(row: ParticipantsPrintRow): string {
  if (row.registrationSource === "admin") return "";
  if (row.status !== "APPROVED") return "";
  try {
    return new Date(row.statusChangedAt).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ParticipantsPrintClient({
  tournamentId,
  tournamentTitle,
  rows,
}: {
  tournamentId: string;
  tournamentTitle: string;
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
            .participants-print-table { font-size: 13pt !important; }
            .participants-print-table th,
            .participants-print-table td { padding: 10px 8px !important; }
          }
          .participants-print-table { width: 100%; border-collapse: collapse; color: #0f172a; }
          .participants-print-table th, .participants-print-table td {
            border: 1px solid #334155;
            padding: 0.55rem 0.45rem;
            text-align: left;
            font-size: 1rem;
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
            승인 참가자 · 이름순 · A4 세로 권장
          </p>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="participants-print-table">
            <thead>
              <tr>
                <th style={{ width: "3rem", textAlign: "center" }}>번호</th>
                <th>이름</th>
                <th style={{ width: "5rem" }}>에버</th>
                <th>전화번호</th>
                <th style={{ width: "7rem" }}>입금일</th>
                <th style={{ width: "4.5rem", textAlign: "center" }} className="participants-print-att-col">
                  출석
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const n = idx + 1;
                const checked = checkedById[row.id] ?? false;
                const deposit = depositLabel(row);
                const ever =
                  row.participantAverage != null && Number.isFinite(row.participantAverage) ? String(row.participantAverage) : "-";
                return (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{n}</td>
                    <td style={{ fontWeight: 700 }}>{row.applicantName}</td>
                    <td>{ever}</td>
                    <td>
                      <span className="participants-print-no-print">{maskPhoneForScreen(row.phone)}</span>
                      <span className="participants-print-phone-full" style={{ display: "none" }}>
                        {row.phone.trim() || "-"}
                      </span>
                    </td>
                    <td>{deposit || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="participants-print-no-print">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={pending === row.id}
                          onChange={(e) => void onToggleAttendance(row.id, e.target.checked)}
                          style={{ width: "1.35rem", height: "1.35rem", cursor: "pointer" }}
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
              .participants-print-phone-full { display: inline !important; }
              .participants-print-cb-print { display: inline !important; font-size: 14pt; }
            }
          `,
          }}
        />
      </main>
    </>
  );
}
