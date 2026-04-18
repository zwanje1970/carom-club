"use client";

import { useEffect, useState } from "react";

type Settings = {
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
  updatedAt: string;
};

export default function MembershipSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [settings, setSettings] = useState<Settings>({
    annualMembershipVisible: false,
    annualMembershipEnforced: false,
    updatedAt: "",
  });
  const modeLabel = !settings.annualMembershipVisible
    ? "무료 서비스 모드 (OFF / OFF)"
    : settings.annualMembershipEnforced
      ? "연회원 제한 모드 (ON / ON)"
      : "연회원 안내 모드 (ON / OFF)";

  function toggleClass(active: boolean) {
    return active
      ? "v3-btn"
      : "v3-btn";
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/platform/platform-settings");
        const result = (await response.json()) as Partial<Settings> & { error?: string };
        if (!response.ok) {
          if (!cancelled) setMessage(result.error ?? "설정을 불러오지 못했습니다.");
          return;
        }
        if (!cancelled) {
          setSettings({
            annualMembershipVisible: !!result.annualMembershipVisible,
            annualMembershipEnforced: !!result.annualMembershipEnforced,
            updatedAt: typeof result.updatedAt === "string" ? result.updatedAt : "",
          });
        }
      } catch {
        if (!cancelled) setMessage("설정을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveState("saving");
    setMessage("");
    const requestedVisible = settings.annualMembershipVisible;
    const requestedEnforced = settings.annualMembershipEnforced;
    const autoAdjusted = requestedEnforced && !requestedVisible;
    try {
      const response = await fetch("/api/platform/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualMembershipVisible: settings.annualMembershipVisible,
          annualMembershipEnforced: settings.annualMembershipEnforced,
        }),
      });
      const result = (await response.json()) as { error?: string; settings?: Settings };
      if (!response.ok) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        setSaveState("error");
        return;
      }
      if (result.settings) setSettings(result.settings);
      setMessage(
        autoAdjusted
          ? "저장되었습니다. 제한 ON이면 노출은 자동으로 ON으로 맞춰집니다."
          : "저장되었습니다."
      );
      setSaveState("success");
    } catch {
      setMessage("저장 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="v3-box v3-stack">
        <p className="v3-muted">불러오는 중...</p>
      </section>
    );
  }

  return (
    <section className="v3-box v3-stack">
      <h2 className="v3-h2">연회원 설정</h2>
      <p className="v3-muted" style={{ margin: 0 }}>현재 모드: {modeLabel}</p>
      <section className="v3-stack" style={{ gap: "0.45rem" }}>
        <div className="v3-stack" style={{ gap: "0.35rem" }}>
          <strong>연회원 관련메뉴 보임</strong>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={toggleClass(settings.annualMembershipVisible)}
              style={{
                minWidth: "4.5rem",
                background: settings.annualMembershipVisible ? "#2563eb" : "#e5e7eb",
                color: settings.annualMembershipVisible ? "#fff" : "#374151",
                borderColor: settings.annualMembershipVisible ? "#2563eb" : "#d1d5db",
              }}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  annualMembershipVisible: !prev.annualMembershipVisible,
                }))
              }
            >
              {settings.annualMembershipVisible ? "ON" : "OFF"}
            </button>
          </div>
          <p className="v3-muted" style={{ margin: 0 }}>
            ON 시 연회원 관련 메뉴와 안내가 표시됩니다
          </p>
        </div>

        <div className="v3-stack" style={{ gap: "0.35rem" }}>
          <strong>연회원 기능 제한</strong>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={toggleClass(settings.annualMembershipEnforced)}
              style={{
                minWidth: "4.5rem",
                background: settings.annualMembershipEnforced ? "#2563eb" : "#e5e7eb",
                color: settings.annualMembershipEnforced ? "#fff" : "#374151",
                borderColor: settings.annualMembershipEnforced ? "#2563eb" : "#d1d5db",
              }}
              onClick={() =>
                setSettings((prev) => {
                  const nextEnforced = !prev.annualMembershipEnforced;
                  return {
                    ...prev,
                    annualMembershipEnforced: nextEnforced,
                    annualMembershipVisible: nextEnforced ? true : prev.annualMembershipVisible,
                  };
                })
              }
            >
              {settings.annualMembershipEnforced ? "ON" : "OFF"}
            </button>
          </div>
          <p className="v3-muted" style={{ margin: 0 }}>
            ON 시 연회원이 아닌 경우 주요 기능이 제한됩니다
          </p>
        </div>
      </section>
      <p className="v3-muted" style={{ margin: 0 }}>
        허용 조합: OFF/OFF(무료), ON/OFF(안내), ON/ON(제한). OFF/ON은 자동으로 ON/ON으로 보정됩니다.
      </p>
      <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <button className="v3-btn" type="button" disabled={saving} onClick={handleSave}>
          저장
        </button>
        {saveState !== "idle" ? (
          <span
            className="v3-muted"
            style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280" }}
          >
            {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
          </span>
        ) : null}
      </div>
      {settings.updatedAt ? <p className="v3-muted">최근 저장: {new Date(settings.updatedAt).toLocaleString("ko-KR")}</p> : null}
      {message ? <p className="v3-muted">{message}</p> : null}
    </section>
  );
}
