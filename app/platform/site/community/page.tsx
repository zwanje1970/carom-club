"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CommunityBoardConfig = {
  visible: boolean;
  label: string;
  order: number;
};

type CommunityConfig = {
  free: CommunityBoardConfig;
  qna: CommunityBoardConfig;
  reviews: CommunityBoardConfig;
  extra1: CommunityBoardConfig;
  extra2: CommunityBoardConfig;
};

const BOARD_KEYS: Array<keyof CommunityConfig> = ["free", "qna", "reviews", "extra1", "extra2"];

function createEmptyConfig(): CommunityConfig {
  return {
    free: { visible: true, label: "", order: 1 },
    qna: { visible: true, label: "", order: 2 },
    reviews: { visible: true, label: "", order: 3 },
    extra1: { visible: false, label: "", order: 4 },
    extra2: { visible: false, label: "", order: 5 },
  };
}

export default function PlatformSiteCommunityPage() {
  const [config, setConfig] = useState<CommunityConfig>(createEmptyConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/platform/site-community");
        const result = (await response.json()) as { config?: CommunityConfig; error?: string };
        if (!response.ok || !result.config) {
          setMessage(result.error ?? "커뮤니티 설정을 불러오지 못했습니다.");
          return;
        }
        setConfig(result.config);
      } catch {
        setMessage("커뮤니티 설정 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
  }, []);

  function updateBoard<K extends keyof CommunityConfig>(key: K, patch: Partial<CommunityBoardConfig>) {
    setConfig((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform/site-community", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = (await response.json()) as { ok?: boolean; config?: CommunityConfig; error?: string };
      if (!response.ok || !result.ok || !result.config) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setConfig(result.config);
      setMessage("커뮤니티 설정이 저장되었습니다.");
    } catch {
      setMessage("커뮤니티 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">게시판 공개 여부, 이름, 순서를 관리합니다.</p>

      {loading ? <p className="v3-muted">불러오는 중...</p> : null}

      {!loading ? (
        <div className="v3-stack">
          {BOARD_KEYS.map((key) => (
            <section key={key} className="v3-box v3-stack">
              <p>
                <strong>슬롯:</strong> {key}
              </p>
              <label className="v3-row" style={{ alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={config[key].visible}
                  onChange={(event) => updateBoard(key, { visible: event.target.checked })}
                />
                <span>공개</span>
              </label>
              <label className="v3-stack">
                <span>이름(label)</span>
                <input
                  type="text"
                  value={config[key].label}
                  onChange={(event) => updateBoard(key, { label: event.target.value })}
                  style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                />
              </label>
              <label className="v3-stack">
                <span>순서(order)</span>
                <input
                  type="number"
                  value={config[key].order}
                  onChange={(event) => updateBoard(key, { order: Number(event.target.value) })}
                  style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                />
              </label>
            </section>
          ))}
        </div>
      ) : null}

      <div className="v3-row">
        <button className="v3-btn" type="button" onClick={handleSave} disabled={saving || loading}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {message ? <p className="v3-muted">{message}</p> : null}
    </main>
  );
}
