"use client";

import { useCallback, useEffect, useState } from "react";

type TvTokenResponse = {
  token: string | null;
  url: string | null;
  error?: string;
};

export default function TournamentTvLinkBlock({ tournamentId }: { tournamentId: string }) {
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
      setMessage("TV 링크를 복사했습니다.");
    } catch {
      setMessage("복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.");
    }
  };

  const hasLink = Boolean(state?.url?.trim());

  return (
    <section className="v3-box v3-stack" style={{ gap: "0.65rem", padding: "1rem" }} aria-label="대진표 TV 링크">
      <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.05rem" }}>
        대진표 TV
      </h2>
      <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        TV·현장 모니터에 표시할 공개 링크입니다. 링크를 알면 누구나 볼 수 있으니 공유에 주의하세요.
      </p>
      {state && hasLink ? (
        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          <code
            style={{
              display: "block",
              wordBreak: "break-all",
              fontSize: "0.85rem",
              padding: "0.5rem 0.65rem",
              borderRadius: "8px",
              background: "var(--v3-site-gray-100, #f0f3f8)",
            }}
          >
            {state.url}
          </code>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" className="v3-btn" disabled={busy} onClick={() => void onCopy()}>
              TV 링크 복사
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="v3-btn" disabled={busy} onClick={() => void onCreate()}>
            {busy ? "처리 중…" : "TV 링크 생성"}
          </button>
        </div>
      )}
      {message ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
