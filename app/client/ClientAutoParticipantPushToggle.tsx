"use client";

import { useCallback, useState } from "react";

type Props = {
  initialEnabled: boolean;
  /** 저장 성공 후 대시보드 summary 캐시 등과 동기화 */
  onPersisted?: (enabled: boolean) => void;
};

export default function ClientAutoParticipantPushToggle({ initialEnabled, onPersisted }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/client/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ autoParticipantPushEnabled: next }),
      });
      const data = (await res.json()) as { error?: string; autoParticipantPushEnabled?: boolean };
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      const saved = data.autoParticipantPushEnabled !== false;
      setEnabled(saved);
      onPersisted?.(saved);
    } catch {
      setErr("요청 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  return (
    <div
      className="client-dashboard-main__extrasRow"
      style={{
        flexDirection: "column",
        alignItems: "stretch",
        gap: "0.35rem",
        borderBottom: "1px solid #e8e8e8",
        paddingBottom: "0.65rem",
        marginBottom: "0.35rem",
      }}
    >
      <button
        type="button"
        disabled={saving}
        onClick={() => void toggle()}
        aria-pressed={enabled}
        aria-label={`참가자 자동 알림, ${enabled ? "켜짐" : "꺼짐"}`}
        className="v3-row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          margin: 0,
          padding: "0.35rem 0",
          border: "none",
          background: "transparent",
          cursor: saving ? "wait" : "pointer",
          textAlign: "left",
          font: "inherit",
          color: "inherit",
        }}
      >
        <span className="client-dashboard-main__extrasRowLabel" style={{ fontWeight: 600 }}>
          참가자 자동 알림
        </span>
        <span
          aria-hidden
          style={{
            position: "relative",
            width: "2.75rem",
            height: "1.5rem",
            borderRadius: "999px",
            flexShrink: 0,
            background: enabled ? "#22c55e" : "#d4d4d4",
            transition: "background 0.15s ease",
            boxShadow: enabled ? "inset 0 0 0 1px rgba(0,0,0,0.06)" : "inset 0 0 0 1px #bdbdbd",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "0.2rem",
              left: enabled ? "calc(100% - 1.1rem - 0.2rem)" : "0.2rem",
              width: "1.1rem",
              height: "1.1rem",
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.15s ease",
            }}
          />
        </span>
      </button>
      <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
        승인 안내와 대회 전날 참석 안내를 자동으로 보냅니다.
      </p>
      {err ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", color: "#b91c1c" }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
