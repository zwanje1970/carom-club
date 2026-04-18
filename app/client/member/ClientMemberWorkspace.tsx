"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type MemberRow = {
  userId: string;
  name: string;
  phone: string;
  pushMarketingAgreed: boolean;
  lastAppliedAt: string;
};

function formatAppliedAt(iso: string): string {
  const t = iso.trim();
  if (!t) return "—";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function ClientMemberWorkspace() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pushOpen, setPushOpen] = useState(false);

  const sendableIds = useMemo(
    () => members.filter((m) => m.pushMarketingAgreed).map((m) => m.userId),
    [members]
  );

  const allSendableSelected =
    sendableIds.length > 0 && sendableIds.every((id) => selected.has(id));

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/client/members", { credentials: "same-origin" });
      const data = (await res.json()) as { error?: string; members?: MemberRow[] };
      if (!res.ok) {
        setLoadError(data.error ?? "목록을 불러오지 못했습니다.");
        setMembers([]);
        return;
      }
      setMembers(Array.isArray(data.members) ? data.members : []);
      setSelected(new Set());
    } catch {
      setLoadError("목록 요청 중 오류가 발생했습니다.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

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

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setNotice({ kind: "err", text: "제목과 내용을 모두 입력해 주세요." });
      return;
    }
    const ids = sendableIds.filter((id) => selected.has(id));
    if (ids.length === 0) {
      setNotice({ kind: "err", text: "발송할 회원을 선택해 주세요." });
      return;
    }
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
        successCount?: number;
        failureCount?: number;
      };
      if (!res.ok) {
        setNotice({ kind: "err", text: data.error ?? "발송에 실패했습니다." });
        return;
      }
      const sc = data.successCount ?? 0;
      const fc = data.failureCount ?? 0;
      let msg = `발송 완료. 푸시 성공 ${sc}건`;
      if (fc > 0) msg += `, 실패 ${fc}건`;
      msg += ".";
      setNotice({ kind: "ok", text: msg });
    } catch {
      setNotice({ kind: "err", text: "발송 요청 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    sendableIds.some((id) => selected.has(id)) && title.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "1rem" }}>
      <div className="v3-row ui-client-dashboard-header" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client" style={{ padding: "0.5rem 0.9rem" }}>
            ← 대시보드
          </Link>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            회원
          </h1>
        </div>
        <button
          type="button"
          className="v3-btn"
          onClick={() => setPushOpen((v) => !v)}
          style={{ padding: "0.5rem 0.9rem", fontWeight: 600 }}
          aria-expanded={pushOpen}
        >
          {pushOpen ? "앱 푸시 닫기" : "앱 푸시 발송"}
        </button>
      </div>

      {pushOpen ? (
        <section className="v3-box v3-stack" style={{ gap: "0.75rem", maxWidth: "36rem" }} aria-label="푸시 발송">
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            마케팅 푸시 발송
          </h2>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            아래 목록에서 수신 대상을 선택한 뒤 발송합니다. 수신 거부 회원은 선택할 수 없습니다.
          </p>

          <label className="v3-stack" style={{ gap: "0.25rem" }}>
            <span style={{ fontWeight: 600 }}>제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={sending}
              maxLength={120}
              style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            />
          </label>
          <label className="v3-stack" style={{ gap: "0.25rem" }}>
            <span style={{ fontWeight: 600 }}>내용</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={5}
              maxLength={2000}
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

          <button
            type="button"
            className="v3-btn"
            disabled={!canSend}
            onClick={() => void handleSend()}
            style={{ alignSelf: "flex-start" }}
          >
            {sending ? "발송 중…" : "푸시 발송"}
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
        </section>
      ) : null}

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "baseline" }}>
        <p style={{ margin: 0, fontSize: "0.95rem", color: "#374151" }}>
          전체 <strong>{members.length}</strong>명
        </p>
        {pushOpen ? (
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#374151" }}>
            선택 <strong>{selected.size}</strong>명
          </p>
        ) : null}
      </div>

      {loadError ? (
        <p className="v3-muted" style={{ margin: 0, color: "#b91c1c" }}>
          {loadError}
        </p>
      ) : null}

      <section
        className="v3-box"
        style={{ padding: 0, overflow: "hidden", border: "1px solid #d4d4d4", borderRadius: "6px" }}
        aria-label="회원 목록"
      >
        {loading ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.75rem 1rem" }}>
            불러오는 중…
          </p>
        ) : members.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.75rem 1rem" }}>
            신청 이력이 있는 회원이 없습니다.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #d4d4d4", textAlign: "left" }}>
                  {pushOpen ? (
                    <th style={{ padding: "0.45rem 0.5rem", width: "2.25rem" }}>
                      <input
                        type="checkbox"
                        checked={allSendableSelected}
                        disabled={sendableIds.length === 0 || sending}
                        onChange={() => toggleSelectAll()}
                        aria-label="전체 선택"
                      />
                    </th>
                  ) : null}
                  <th style={{ padding: "0.45rem 0.65rem" }}>이름</th>
                  <th style={{ padding: "0.45rem 0.65rem" }}>전화번호</th>
                  <th style={{ padding: "0.45rem 0.65rem" }}>마케팅 수신</th>
                  <th style={{ padding: "0.45rem 0.65rem" }}>최근 신청</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const canSelect = m.pushMarketingAgreed;
                  const rowMuted = !canSelect;
                  return (
                    <tr
                      key={m.userId}
                      onClick={pushOpen ? () => toggleId(m.userId, canSelect) : undefined}
                      style={{
                        borderBottom: "1px solid #e5e5e5",
                        cursor: pushOpen ? (canSelect ? "pointer" : "not-allowed") : "default",
                        opacity: rowMuted ? 0.55 : 1,
                        background: rowMuted ? "#fafafa" : "#fff",
                      }}
                    >
                      {pushOpen ? (
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
                      ) : null}
                      <td style={{ padding: "0.35rem 0.65rem", fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: "0.35rem 0.65rem" }}>{m.phone}</td>
                      <td style={{ padding: "0.35rem 0.65rem", color: canSelect ? "#166534" : "#b91c1c", fontWeight: 600 }}>
                        {canSelect ? "동의" : "거부 · 발송 제외"}
                      </td>
                      <td style={{ padding: "0.35rem 0.65rem", color: "#525252" }}>{formatAppliedAt(m.lastAppliedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
