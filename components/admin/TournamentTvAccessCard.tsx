"use client";

import { useEffect, useState } from "react";

type ApiState = {
  token: string | null;
  shareUrl: string | null;
  issuedAt: string | null;
};

export function TournamentTvAccessCard({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tv-access-token`, {
        credentials: "include",
      });
      const json = (await res.json()) as ApiState & { error?: string };
      if (!res.ok) {
        setMessage(json.error || "TV 토큰을 불러오지 못했습니다.");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const generate = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tv-access-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = (await res.json()) as ApiState & { error?: string };
      if (!res.ok) {
        setMessage(json.error || "TV 토큰 생성에 실패했습니다.");
        return;
      }
      setData(json);
      setMessage("TV 공개 링크가 생성되었습니다.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!data?.shareUrl) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setMessage("TV 링크를 복사했습니다.");
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-site-border bg-site-card p-4 text-sm text-gray-500">
        TV 공개 링크를 불러오는 중…
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-site-border bg-site-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-site-text">TV 공개 토큰 링크</h3>
          <p className="mt-1 text-sm text-gray-600">
            공개 토큰 URL로 TV 화면을 로그인 없이 열 수 있습니다.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {data?.issuedAt ? `발급 시각: ${data.issuedAt}` : "아직 토큰이 발급되지 않았습니다."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={saving}
            className="rounded-lg bg-site-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "생성 중..." : data?.token ? "재발급" : "토큰 생성"}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!data?.shareUrl}
            className="rounded-lg border border-site-border px-3 py-2 text-sm font-medium text-site-text hover:bg-site-bg disabled:opacity-50"
          >
            링크 복사
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-site-border bg-site-bg p-3 text-sm">
        <div className="text-gray-500">공유 URL</div>
        <div className="mt-1 break-all font-medium text-site-text">{data?.shareUrl ?? "-"}</div>
      </div>

      {message && <p className="mt-3 text-sm text-site-primary">{message}</p>}
    </section>
  );
}
