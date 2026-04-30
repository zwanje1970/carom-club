"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTournamentScheduleLabel } from "../../../lib/tournament-schedule";

const PUSH_TITLE_MAX_LEN = 30;
const PUSH_BODY_MAX_LEN = 60;

type TournamentListItem = {
  id: string;
  title: string;
  date?: string;
  eventDates?: string[];
};

type ApplicantRow = {
  userId: string;
  name: string;
  pushMarketingAgreed: boolean;
};

function tournamentOptionLabel(t: TournamentListItem): string {
  const schedule = formatTournamentScheduleLabel({
    date: typeof t.date === "string" ? t.date : "",
    eventDates: Array.isArray(t.eventDates) ? t.eventDates : [],
  });
  const title = (t.title ?? "").trim() || "(제목 없음)";
  return schedule ? `${title} · ${schedule}` : title;
}

export default function TournamentParticipantsPushTab() {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const [tournamentId, setTournamentId] = useState("");
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantsError, setApplicantsError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const sendableIds = useMemo(
    () => applicants.filter((a) => a.pushMarketingAgreed).map((a) => a.userId),
    [applicants],
  );

  const selectedSendableCount = useMemo(
    () => sendableIds.filter((id) => selected.has(id)).length,
    [sendableIds, selected],
  );

  const allSendableSelected =
    sendableIds.length > 0 && sendableIds.every((id) => selected.has(id));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTournamentsLoading(true);
      setTournamentsError(null);
      try {
        const res = await fetch("/api/client/tournaments", { credentials: "same-origin" });
        const data = (await res.json()) as { error?: string; tournaments?: TournamentListItem[] };
        if (cancelled) return;
        if (!res.ok) {
          setTournamentsError(data.error ?? "대회 목록을 불러오지 못했습니다.");
          setTournaments([]);
          return;
        }
        setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
      } catch {
        if (!cancelled) {
          setTournamentsError("대회 목록 요청 중 오류가 발생했습니다.");
          setTournaments([]);
        }
      } finally {
        if (!cancelled) setTournamentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tid = tournamentId.trim();
    if (!tid) {
      setApplicants([]);
      setApplicantsError(null);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setApplicantsLoading(true);
      setApplicantsError(null);
      try {
        const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tid)}/approved-applicants`, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as { error?: string; applicants?: ApplicantRow[] };
        if (cancelled) return;
        if (!res.ok) {
          setApplicantsError(data.error ?? "참가자를 불러오지 못했습니다.");
          setApplicants([]);
          setSelected(new Set());
          return;
        }
        const rows = Array.isArray(data.applicants) ? data.applicants : [];
        setApplicants(rows);
        const sendable = rows.filter((r) => r.pushMarketingAgreed).map((r) => r.userId);
        setSelected(new Set(sendable));
      } catch {
        if (!cancelled) {
          setApplicantsError("참가자 요청 중 오류가 발생했습니다.");
          setApplicants([]);
          setSelected(new Set());
        }
      } finally {
        if (!cancelled) setApplicantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const toggleId = useCallback((userId: string, canSelect: boolean) => {
    if (!canSelect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (sendableIds.length === 0) return;
    setSelected((prev) => {
      if (allSendableSelected) {
        const next = new Set(prev);
        for (const id of sendableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of sendableIds) next.add(id);
      return next;
    });
  }, [allSendableSelected, sendableIds]);

  const handleSend = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      setNotice({ kind: "err", text: "제목과 내용을 모두 입력해 주세요." });
      return;
    }
    if (
      title.length > PUSH_TITLE_MAX_LEN ||
      body.length > PUSH_BODY_MAX_LEN ||
      title.trim().length > PUSH_TITLE_MAX_LEN ||
      body.trim().length > PUSH_BODY_MAX_LEN
    ) {
      setNotice({ kind: "err", text: "제목·내용 글자 수를 제한 이내로 줄여 주세요." });
      return;
    }
    const ids = sendableIds.filter((id) => selected.has(id));
    if (ids.length === 0) {
      setNotice({ kind: "err", text: "발송할 참가자를 선택해 주세요." });
      return;
    }
    if (!window.confirm(`선택한 ${ids.length}명에게 메시지를 발송하시겠습니까?`)) return;

    setSending(true);
    setNotice(null);
    try {
      const payload: { title: string; body: string; targetUserIds: string[]; url?: string } = {
        title: title.trim(),
        body: body.trim(),
        targetUserIds: ids,
      };
      if (linkUrl.trim()) payload.url = linkUrl.trim();

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        successCount?: number;
        failureCount?: number;
        targetParticipantCount?: number;
        eligibleUserCount?: number;
        tokenCount?: number;
      };
      if (!res.ok) {
        setNotice({ kind: "err", text: data.error ?? "발송에 실패했습니다." });
        return;
      }
      if (data.ok === true) {
        const sc = data.successCount ?? 0;
        const fc = data.failureCount ?? 0;
        const total = typeof data.targetParticipantCount === "number" ? data.targetParticipantCount : ids.length;
        const eligible = typeof data.eligibleUserCount === "number" ? data.eligibleUserCount : total;
        const tokenCount = typeof data.tokenCount === "number" ? data.tokenCount : 0;
        setNotice({
          kind: "ok",
          text: `참가자 ${total}명 중 푸시 수신 동의 ${eligible}명 · 등록 토큰 ${tokenCount}개 — 성공 ${sc}건, 실패 ${fc}건`,
        });
        return;
      }
      const sc = data.successCount ?? 0;
      const fc = data.failureCount ?? 0;
      setNotice({ kind: "ok", text: `발송 완료. 푸시 성공 ${sc}건${fc > 0 ? `, 실패 ${fc}건` : ""}.` });
    } catch {
      setNotice({ kind: "err", text: "발송 요청 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }, [title, body, linkUrl, sendableIds, selected]);

  const canSend =
    selectedSendableCount > 0 &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    title.length <= PUSH_TITLE_MAX_LEN &&
    body.length <= PUSH_BODY_MAX_LEN &&
    !sending &&
    !!tournamentId.trim();

  return (
    <section className="v3-stack" style={{ gap: "0.85rem", maxWidth: "36rem" }} aria-label="대회별 참가자 푸시">
      <label className="v3-stack" style={{ gap: "0.35rem" }}>
        <span style={{ fontWeight: 600 }}>대회 선택</span>
        <select
          value={tournamentId}
          disabled={tournamentsLoading || sending}
          onChange={(e) => setTournamentId(e.target.value)}
          style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", fontSize: "0.95rem" }}
        >
          <option value="">대회를 선택하세요</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {tournamentOptionLabel(t)}
            </option>
          ))}
        </select>
      </label>
      {tournamentsError ? (
        <p className="v3-muted" style={{ margin: 0, color: "#b91c1c" }}>
          {tournamentsError}
        </p>
      ) : null}

      {tournamentId.trim() ? (
        <>
          <label className="v3-stack" style={{ gap: "0.25rem" }}>
            <span style={{ fontWeight: 600 }}>
              제목{" "}
              <span style={{ fontWeight: 500, color: "#525252" }}>
                {title.length} / {PUSH_TITLE_MAX_LEN}
              </span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={sending}
              maxLength={PUSH_TITLE_MAX_LEN}
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <label className="v3-stack" style={{ gap: "0.25rem" }}>
            <span style={{ fontWeight: 600 }}>
              내용{" "}
              <span style={{ fontWeight: 500, color: "#525252" }}>
                {body.length} / {PUSH_BODY_MAX_LEN}
              </span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={5}
              maxLength={PUSH_BODY_MAX_LEN}
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <label className="v3-stack" style={{ gap: "0.25rem" }}>
            <span style={{ fontWeight: 600 }}>이동 링크 (선택)</span>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={sending}
              placeholder="비우면 푸시 탭 시 기본 페이지로 이동합니다"
              autoComplete="off"
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>

          <p style={{ margin: 0, fontSize: "0.95rem", color: "#374151" }}>
            전체 <strong>{sendableIds.length}</strong>명 / 선택 <strong>{selectedSendableCount}</strong>명
          </p>

          {applicantsLoading ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              불러오는 중…
            </p>
          ) : applicantsError ? (
            <p className="v3-muted" style={{ margin: 0, color: "#b91c1c" }}>
              {applicantsError}
            </p>
          ) : applicants.length === 0 ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              승인된 참가자가 없습니다.
            </p>
          ) : (
            <section
              className="v3-box"
              style={{ padding: 0, overflow: "hidden", border: "1px solid #d4d4d4", borderRadius: "6px" }}
              aria-label="승인 참가자 목록"
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #d4d4d4", textAlign: "left" }}>
                      <th style={{ padding: "0.45rem 0.5rem", width: "2.25rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={allSendableSelected}
                            disabled={sendableIds.length === 0 || sending}
                            onChange={() => toggleSelectAll()}
                            aria-label="전체선택"
                          />
                          <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>전체선택</span>
                        </label>
                      </th>
                      <th style={{ padding: "0.45rem 0.65rem" }}>이름</th>
                      <th style={{ padding: "0.45rem 0.65rem" }}>마케팅 수신</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((m) => {
                      const canSelect = m.pushMarketingAgreed;
                      const rowMuted = !canSelect;
                      return (
                        <tr
                          key={m.userId}
                          onClick={() => toggleId(m.userId, canSelect)}
                          style={{
                            borderBottom: "1px solid #e5e5e5",
                            cursor: canSelect ? "pointer" : "not-allowed",
                            opacity: rowMuted ? 0.55 : 1,
                            background: rowMuted ? "#fafafa" : "#fff",
                          }}
                        >
                          <td style={{ padding: "0.35rem 0.5rem", verticalAlign: "middle" }}>
                            <input
                              type="checkbox"
                              checked={selected.has(m.userId)}
                              disabled={!canSelect || sending}
                              readOnly
                              tabIndex={-1}
                              style={{ pointerEvents: "none" }}
                              aria-label={`${m.name} 선택`}
                            />
                          </td>
                          <td style={{ padding: "0.35rem 0.65rem", fontWeight: 600 }}>{m.name}</td>
                          <td
                            style={{
                              padding: "0.35rem 0.65rem",
                              color: canSelect ? "#166534" : "#b91c1c",
                              fontWeight: 600,
                            }}
                          >
                            {canSelect ? "동의" : "거부 · 발송 제외"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <button type="button" className="v3-btn" disabled={!canSend} onClick={() => void handleSend()}>
            {sending ? "발송 중…" : `선택한 ${selectedSendableCount}명에게 발송`}
          </button>

          {notice ? (
            <p
              className="v3-muted"
              role="status"
              style={{
                margin: 0,
                color: notice.kind === "ok" ? "#166534" : "#b91c1c",
              }}
            >
              {notice.text}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
