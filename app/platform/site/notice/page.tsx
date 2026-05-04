"use client";

import { useEffect, useState } from "react";

type SiteNotice = {
  enabled: boolean;
  text: string;
};

export default function PlatformSiteNoticePage() {
  const [notice, setNotice] = useState<SiteNotice>({ enabled: false, text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadNotice() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/platform/site-notice", { cache: "no-store" });
        const result = (await response.json()) as { notice?: SiteNotice; error?: string };
        if (!response.ok || !result.notice) {
          setMessage(result.error ?? "공지 설정을 불러오지 못했습니다.");
          return;
        }
        setNotice(result.notice);
      } catch {
        setMessage("공지 설정 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadNotice();
  }, []);

  async function handleSave() {
    console.log("저장 클릭");
    if (saving) {
      console.log("막힘: saving true → return (fetch 미실행)");
      return;
    }
    console.log("fetch 직전");
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform/site-notice", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: notice.enabled,
          text: notice.text,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; notice?: SiteNotice; error?: string };
      if (!response.ok || !result.ok || !result.notice) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setNotice(result.notice);
      setMessage("공지 설정이 저장되었습니다.");
    } catch {
      setMessage("공지 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">사이트 전체에 사용할 1줄 공지입니다.</p>

      {loading ? <p className="v3-muted">불러오는 중...</p> : null}

      <section className="v3-box v3-stack">
        <label className="v3-row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={notice.enabled}
            onChange={(event) => setNotice((prev) => ({ ...prev, enabled: event.target.checked }))}
          />
          <span>공지 활성화</span>
        </label>

        <label className="v3-stack">
          <span>공지 문구</span>
          <input
            type="text"
            maxLength={100}
            value={notice.text}
            onChange={(event) => setNotice((prev) => ({ ...prev, text: event.target.value }))}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
      </section>

      <div className="v3-row">
        <button className="v3-btn" type="button" onClick={handleSave} disabled={loading || saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {message ? <p className="v3-muted">{message}</p> : null}
    </main>
  );
}
