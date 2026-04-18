"use client";

import { useState } from "react";

type Audience = "all" | "client";

export default function PlatformPushBroadcastClient() {
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setNotice({ kind: "err", text: "제목과 내용을 모두 입력해 주세요." });
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience,
        ...(linkUrl.trim() ? { url: linkUrl.trim() } : {}),
      };
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        sent?: number;
        successCount?: number;
        failureCount?: number;
      };
      if (!res.ok) {
        setNotice({ kind: "err", text: data.error ?? "발송에 실패했습니다." });
        return;
      }
      const sent = typeof data.sent === "number" ? data.sent : 0;
      const sc = data.successCount ?? 0;
      const fc = data.failureCount ?? 0;
      let pushDetail = "";
      if (fc > 0) {
        pushDetail = ` 푸시 일부 실패: 성공 ${sc}건, 실패 ${fc}건.`;
      } else {
        pushDetail = ` 푸시 성공 ${sc}건.`;
      }
      setNotice({
        kind: "ok",
        text: `알림 + 푸시 발송 완료. 내부 알림 ${sent}건.${pushDetail}`,
      });
    } catch {
      setNotice({ kind: "err", text: "발송 요청 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="v3-stack" style={{ gap: "1rem", maxWidth: "32rem" }}>
      <div className="v3-stack" style={{ gap: "0.5rem" }}>
        <span style={{ fontWeight: 600 }}>발송 대상</span>
        <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="radio"
            name="platform-push-audience"
            checked={audience === "all"}
            onChange={() => setAudience("all")}
            disabled={sending}
          />
          <span>전체 회원</span>
        </label>
        <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="radio"
            name="platform-push-audience"
            checked={audience === "client"}
            onChange={() => setAudience("client")}
            disabled={sending}
          />
          <span>클라이언트 계정</span>
        </label>
      </div>

      <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
        메시지
      </h2>
      <label className="v3-stack">
        <span>제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={sending}
          maxLength={120}
          style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
        />
      </label>
      <label className="v3-stack">
        <span>내용</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sending}
          rows={5}
          maxLength={2000}
          style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
        />
      </label>
      <label className="v3-stack">
        <span>이동 링크 (선택)</span>
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
        disabled={sending}
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
    </div>
  );
}
