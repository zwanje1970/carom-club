"use client";

import { useCallback, useEffect, useState } from "react";

type TvTokenResponse = {
  token: string | null;
  url: string | null;
  error?: string;
};

function IconTv() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <rect x="3" y="5" width={18} height={12} rx={2} stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const QR_DISPLAY_PX = 280;

export default function TournamentTvLinkBlock({
  tournamentId,
  presentation = "hubModal",
}: {
  tournamentId: string;
  presentation?: "hubModal";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TvTokenResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = tournamentId.trim();
    if (!id) return;
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/tv-access-token`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as TvTokenResponse;
      if (!res.ok) {
        setState(null);
        setMessage(json.error ?? "TV 링크 정보를 불러오지 못했습니다.");
        return;
      }
      setState({ token: json.token ?? null, url: json.url ?? null });
      setMessage(null);
    } catch {
      setState(null);
      setMessage("네트워크 오류로 불러오지 못했습니다.");
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const onCreate = async () => {
    const id = tournamentId.trim();
    if (!id) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/tv-access-token`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as TvTokenResponse;
      if (!res.ok) {
        setMessage(json.error ?? "TV 링크를 만들지 못했습니다.");
        return;
      }
      setState({ token: json.token ?? null, url: json.url ?? null });
    } catch {
      setMessage("네트워크 오류로 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    const url = state?.url?.trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했습니다. TV 브라우저 주소창에 붙여넣을 수 있습니다.");
    } catch {
      setMessage("복사에 실패했습니다.");
    }
  };

  const onDisconnect = async () => {
    const id = tournamentId.trim();
    if (!id) return;
    if (!window.confirm("TV 공개 링크 연결을 끊을까요? 기존 링크로는 더 이상 접속할 수 없습니다.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/tv-access-token`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(typeof json.error === "string" ? json.error : "연결 해제에 실패했습니다.");
        return;
      }
      setState({ token: null, url: null });
      setMessage("연결을 끊었습니다.");
    } catch {
      setMessage("네트워크 오류로 해제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const hasLink = Boolean(state?.url?.trim());
  const hubUrl = state?.url?.trim() ?? "";

  if (presentation !== "hubModal") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="client-tournament-manage__hubTvTrigger"
        onClick={() => setOpen(true)}
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconTv />
        </span>
        <span className="client-tournament-manage__featureTitle">대진표 TV 연결</span>
      </button>

      {open ? (
        <div
          className="client-tournament-manage__tvModalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="client-tournament-manage__tvModal" role="dialog" aria-modal="true" aria-label="대진표 TV 연결">
            <div className="client-tournament-manage__tvModalHead">
              <h2 className="client-tournament-manage__tvModalTitle">대진표 TV 연결</h2>
              <button type="button" className="v3-btn" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <p className="v3-muted" style={{ margin: "0 0 0.65rem", fontSize: "0.88rem" }}>
              현장 TV는 아래 QR을 카메라로 스캔하거나, 링크 복사 후 TV 브라우저에 붙여넣으세요.
            </p>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", fontWeight: 700 }}>
              상태:{" "}
              <span style={{ color: hasLink ? "#166534" : "#64748b" }}>{hasLink ? "연결됨" : "연결 안 됨"}</span>
            </p>

            {hasLink && hubUrl ? (
              <div className="client-tournament-manage__tvQrBlock">
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>QR</p>
                <p className="v3-muted" style={{ margin: "0 0 0.65rem", fontSize: "0.82rem", lineHeight: 1.45 }}>
                  TV에서 QR 스캔: TV·셋톱박스 브라우저 또는 카메라 앱으로 코드를 비추면 접속할 수 있습니다.
                </p>
                <div className="client-tournament-manage__tvQrWrap">
                  <img
                    alt="TV 공개 링크 QR"
                    width={QR_DISPLAY_PX}
                    height={QR_DISPLAY_PX}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_DISPLAY_PX}x${QR_DISPLAY_PX}&data=${encodeURIComponent(hubUrl)}`}
                  />
                </div>
              </div>
            ) : (
              <p className="v3-muted" style={{ margin: "0 0 0.85rem", fontSize: "0.85rem" }}>
                공개 링크를 만든 뒤 QR이 표시됩니다.
              </p>
            )}

            <div className="client-tournament-manage__tvModalActions">
              <button type="button" className="v3-btn" disabled={busy || !hasLink} onClick={() => void onCopy()}>
                링크 복사
              </button>
              <button type="button" className="v3-btn" disabled={busy} onClick={() => void onCreate()}>
                {busy ? "처리 중…" : hasLink ? "새 링크 발급" : "공개 링크 생성"}
              </button>
              <button type="button" className="v3-btn" disabled={busy || !hasLink} onClick={() => void onDisconnect()}>
                연결 끊기
              </button>
            </div>

            {message ? (
              <p className="v3-muted" style={{ margin: "0.65rem 0 0", fontSize: "0.85rem" }}>
                {message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
