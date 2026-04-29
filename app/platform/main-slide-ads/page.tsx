"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

const previewBoxStyle: CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: "0.4rem",
  padding: "0.85rem",
  background: "#fff",
  maxWidth: 360,
};

const previewImageWrapStyle: CSSProperties = {
  maxWidth: "100%",
  width: "100%",
  maxHeight: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  border: "1px solid #e0e0e0",
  borderRadius: "0.35rem",
  background: "#f5f5f5",
};

type ScheduleEdge = "none" | { ms: number } | "invalid";

function scheduleEdge(iso: string): ScheduleEdge {
  const t = iso.trim();
  if (!t) return "none";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return "invalid";
  return { ms };
}

/** 관리 UI용: 현재 시각 기준 노출 상태 문구. 날짜 파싱 불가 시 "날짜 확인 필요". */
function adminExposureStatusLabel(row: AdRow, nowMs: number): string {
  if (!row.isActive) return "비활성";
  const start = scheduleEdge(row.startAt);
  const end = scheduleEdge(row.endAt);
  if (start === "invalid" || end === "invalid") return "날짜 확인 필요";
  const startMs = start === "none" ? null : start.ms;
  const endMs = end === "none" ? null : end.ms;
  if (startMs !== null && endMs !== null && startMs > endMs) return "날짜 확인 필요";
  if (startMs !== null && nowMs < startMs) return "예약";
  if (endMs !== null && nowMs > endMs) return "종료";
  return "노출 가능";
}

function formatScheduleEdgeKo(edge: ScheduleEdge): string {
  if (edge === "none") return "제한 없음";
  if (edge === "invalid") return "날짜 확인 필요";
  try {
    return new Date(edge.ms).toLocaleString("ko-KR");
  } catch {
    return "날짜 확인 필요";
  }
}

function AdminAdImagePreview({ imageUrl }: { imageUrl: string }) {
  const trimmed = imageUrl.trim();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [trimmed]);

  if (!trimmed) {
    return <p className="v3-muted" style={{ margin: 0 }}>이미지 없음</p>;
  }
  if (broken) {
    return <p className="v3-muted" style={{ margin: 0 }}>이미지를 불러올 수 없음</p>;
  }
  return (
    <img
      src={trimmed}
      alt=""
      onError={() => setBroken(true)}
      onLoad={() => setBroken(false)}
      style={{
        maxWidth: "100%",
        maxHeight: 200,
        width: "auto",
        height: "auto",
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

const inputStyle: CSSProperties = { padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", width: "100%" };

type MainSlideAdConfig = {
  enabled: boolean;
  insertInterval: number;
  adsPerInsert: number;
  rotationMode: "sequential" | "random";
  maxAdsPerCycle: number;
  /** 카드 이동 시간(초) — 5~20, 기본 10 */
  cardMoveDurationSec: number;
};

type AdRow = {
  id: string;
  adName: string;
  advertiserName: string;
  imageUrl: string;
  externalLink: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
  weight: number;
  impressions: number;
  clicks: number;
};

function defaultConfig(): MainSlideAdConfig {
  return {
    enabled: false,
    insertInterval: 10,
    adsPerInsert: 1,
    rotationMode: "sequential",
    maxAdsPerCycle: 1,
    cardMoveDurationSec: 10,
  };
}

function createEmptyAdRow(): AdRow {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ad-${Date.now()}`,
    adName: "",
    advertiserName: "",
    imageUrl: "",
    externalLink: "",
    isActive: true,
    startAt: "",
    endAt: "",
    weight: 0,
    impressions: 0,
    clicks: 0,
  };
}

function adFromApi(row: unknown): AdRow {
  if (!row || typeof row !== "object") return createEmptyAdRow();
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : createEmptyAdRow().id;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
  const str = (v: unknown) => (typeof v === "string" ? v : v === null ? "" : "");
  return {
    id,
    adName: str(r.adName),
    advertiserName: str(r.advertiserName),
    imageUrl: str(r.imageUrl),
    externalLink: str(r.externalLink),
    isActive: typeof r.isActive === "boolean" ? r.isActive : false,
    startAt: parseableIsoOrEmpty(str(r.startAt)),
    endAt: parseableIsoOrEmpty(str(r.endAt)),
    weight: num(r.weight, 0),
    impressions: num(r.impressions, 0),
    clicks: num(r.clicks, 0),
  };
}

function configFromApi(raw: unknown): MainSlideAdConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled === "boolean") base.enabled = r.enabled;
  const ins = Number(r.insertInterval);
  if (Number.isFinite(ins)) base.insertInterval = Math.max(0, Math.floor(ins));
  const ap = Number(r.adsPerInsert);
  if (Number.isFinite(ap)) base.adsPerInsert = Math.max(0, Math.floor(ap));
  const mx = Number(r.maxAdsPerCycle);
  if (Number.isFinite(mx)) base.maxAdsPerCycle = Math.max(0, Math.floor(mx));
  if (r.rotationMode === "random" || r.rotationMode === "sequential") {
    base.rotationMode = r.rotationMode;
  }
  const moveSec = Number(r.cardMoveDurationSec);
  if (Number.isFinite(moveSec)) {
    base.cardMoveDurationSec = Math.min(20, Math.max(5, Math.round(moveSec)));
  }
  return base;
}

function formatCtr(impressions: number, clicks: number): string {
  if (!Number.isFinite(impressions) || impressions <= 0) return "0%";
  const ratio = clicks / impressions;
  return `${(ratio * 100).toFixed(2)}%`;
}

function clampNonNegativeInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** 서버에서 받은 값 → 상태용 ISO(정규화). 파싱 불가면 빈 문자열. */
function parseableIsoOrEmpty(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

/** 상태의 ISO → datetime-local value. 파싱 불가면 빈 문자열(입력 비움). */
function isoToDatetimeLocalValue(iso: string): string {
  const t = iso.trim();
  if (!t) return "";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local → UTC ISO 문자열(API·상태 동일 형식). 빈 값이면 "". */
function datetimeLocalToIso(local: string): string {
  const v = local.trim();
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const min = Number(m[5]);
  if (![y, mo, d, hh, min].every((x) => Number.isFinite(x))) return "";
  const dt = new Date(y, mo - 1, d, hh, min, 0, 0);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

export default function PlatformMainSlideAdsPage() {
  const [config, setConfig] = useState<MainSlideAdConfig>(defaultConfig);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingAds, setSavingAds] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingByAdId, setUploadingByAdId] = useState<Record<string, boolean>>({});
  const [uploadErrorByAdId, setUploadErrorByAdId] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [cfgRes, adsRes] = await Promise.all([
        fetch("/api/platform/main-slide-ad-config", { cache: "no-store" }),
        fetch("/api/platform/main-slide-ads", { cache: "no-store" }),
      ]);
      const cfgJson = (await cfgRes.json()) as { ok?: boolean; config?: unknown; error?: string };
      const adsJson = (await adsRes.json()) as { ok?: boolean; ads?: unknown[]; error?: string };

      if (!cfgRes.ok || !cfgJson.ok) {
        setMessage(cfgJson.error ?? "광고 설정을 불러오지 못했습니다.");
        return;
      }
      if (!adsRes.ok || !adsJson.ok || !Array.isArray(adsJson.ads)) {
        setMessage(adsJson.error ?? "광고 목록을 불러오지 못했습니다.");
        return;
      }
      setConfig(configFromApi(cfgJson.config));
      setAds(adsJson.ads.map(adFromApi));
    } catch {
      setMessage("데이터 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSaveConfig() {
    if (savingConfig) return;
    setSavingConfig(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform/main-slide-ad-config", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          insertInterval: config.insertInterval,
          adsPerInsert: config.adsPerInsert,
          rotationMode: config.rotationMode,
          maxAdsPerCycle: config.maxAdsPerCycle,
          cardMoveDurationSec: config.cardMoveDurationSec,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; config?: unknown; error?: string };
      if (!response.ok || !result.ok || !result.config) {
        setMessage(result.error ?? "설정 저장에 실패했습니다.");
        return;
      }
      setConfig(configFromApi(result.config));
      setMessage("광고 삽입 설정이 저장되었습니다.");
    } catch {
      setMessage("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSaveAds() {
    if (savingAds) return;
    setMessage("");
    for (const row of ads) {
      if (!row.imageUrl.trim() || !row.externalLink.trim()) continue;
      const s = row.startAt.trim();
      const e = row.endAt.trim();
      if (s && e) {
        const msS = Date.parse(s);
        const msE = Date.parse(e);
        if (Number.isFinite(msS) && Number.isFinite(msE) && msS > msE) {
          setMessage(
            `「${row.adName.trim() || row.id}」광고: 시작일은 종료일보다 늦을 수 없습니다. 날짜를 수정한 뒤 다시 저장해 주세요.`
          );
          return;
        }
      }
    }
    setSavingAds(true);
    const payload = ads
      .map((row) => ({
        id: row.id.trim() || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ad-${Date.now()}`),
        adName: row.adName.trim(),
        advertiserName: row.advertiserName.trim(),
        imageUrl: row.imageUrl.trim(),
        externalLink: row.externalLink.trim(),
        isActive: row.isActive,
        startAt: row.startAt.trim() || null,
        endAt: row.endAt.trim() || null,
        weight: row.weight,
        impressions: row.impressions,
        clicks: row.clicks,
      }))
      .filter((row) => row.imageUrl.length > 0 && row.externalLink.length > 0);

    try {
      const response = await fetch("/api/platform/main-slide-ads", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ads: payload }),
      });
      const result = (await response.json()) as { ok?: boolean; ads?: unknown[]; error?: string };
      if (!response.ok || !result.ok || !Array.isArray(result.ads)) {
        setMessage(result.error ?? "광고 목록 저장에 실패했습니다.");
        return;
      }
      setAds(result.ads.map(adFromApi));
      setMessage("광고 목록이 저장되었습니다. (이미지 URL·외부 링크가 모두 있는 항목만 반영되었습니다.)");
    } catch {
      setMessage("광고 목록 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingAds(false);
    }
  }

  function updateAd(index: number, patch: Partial<AdRow>) {
    setAds((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeAdFromState(index: number) {
    const id = ads[index]?.id;
    setAds((prev) => prev.filter((_, i) => i !== index));
    if (id) {
      setUploadErrorByAdId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setUploadingByAdId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleSoftDeleteAd(index: number) {
    const row = ads[index];
    if (!row?.id) return;
    if (!confirm("삭제하면 백업함으로 이동하며 복구할 수 있습니다.")) return;
    try {
      const res = await fetch(`/api/platform/main-slide-ads/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (res.status === 404) {
        removeAdFromState(index);
        return;
      }
      if (!res.ok) {
        setMessage("광고 삭제에 실패했습니다.");
        return;
      }
      removeAdFromState(index);
      setMessage("광고를 백업함으로 옮겼습니다. 메인·목록에서 즉시 숨겨집니다.");
    } catch {
      setMessage("광고 삭제 중 오류가 발생했습니다.");
    }
  }

  async function handleAdImageUpload(index: number, files: FileList | null) {
    const row = ads[index];
    const file = files?.[0];
    if (!row || !file) return;
    setUploadErrorByAdId((prev) => ({ ...prev, [row.id]: "" }));
    setUploadingByAdId((prev) => ({ ...prev, [row.id]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/platform/upload-image", { method: "POST", body: fd, cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; image320Url?: string; image640Url?: string; error?: string };
      if (!res.ok || !data.ok || typeof data.image320Url !== "string" || !data.image320Url.trim()) {
        setUploadErrorByAdId((prev) => ({
          ...prev,
          [row.id]: data.error ?? "이미지 업로드에 실패했습니다.",
        }));
        return;
      }
      const url = data.image320Url.trim();
      setAds((prev) => {
        const i = prev.findIndex((r) => r.id === row.id);
        if (i < 0) return prev;
        return prev.map((r, j) => (j === i ? { ...r, imageUrl: url } : r));
      });
      setMessage("이미지가 업로드되어 320px URL이 반영되었습니다.");
    } catch {
      setUploadErrorByAdId((prev) => ({ ...prev, [row.id]: "업로드 중 오류가 발생했습니다." }));
    } finally {
      setUploadingByAdId((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
  }

  return (
    <main className="v3-page v3-stack">
      <p className="v3-muted">
        <Link href="/platform/site">← 사이트 관리</Link>
        {" · "}
        <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
      </p>
      <h1 className="v3-h1">메인 슬라이드 광고</h1>
      <p className="v3-muted">메인 홈 슬라이드에 삽입되는 광고 카드와 삽입 규칙을 관리합니다.</p>

      {loading ? <p className="v3-muted">불러오는 중...</p> : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">광고 삽입 설정</h2>
        <label className="v3-row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={loading}
            onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
          />
          <span>광고 사용</span>
        </label>
        <label className="v3-stack">
          <span>insertInterval (대회 카드 N개마다 삽입)</span>
          <input
            type="number"
            min={0}
            disabled={loading}
            value={config.insertInterval}
            onChange={(e) =>
              setConfig((c) => ({ ...c, insertInterval: clampNonNegativeInt(e.target.value, c.insertInterval) }))
            }
            style={inputStyle}
          />
        </label>
        <label className="v3-stack">
          <span>adsPerInsert (삽입 시 연속 광고 개수)</span>
          <input
            type="number"
            min={0}
            disabled={loading}
            value={config.adsPerInsert}
            onChange={(e) =>
              setConfig((c) => ({ ...c, adsPerInsert: clampNonNegativeInt(e.target.value, c.adsPerInsert) }))
            }
            style={inputStyle}
          />
        </label>
        <label className="v3-stack">
          <span>rotationMode</span>
          <select
            disabled={loading}
            value={config.rotationMode}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                rotationMode: e.target.value === "random" ? "random" : "sequential",
              }))
            }
            style={inputStyle}
          >
            <option value="sequential">sequential</option>
            <option value="random">random</option>
          </select>
        </label>
        <label className="v3-stack">
          <span>maxAdsPerCycle (한 사이클 최대 광고 수)</span>
          <input
            type="number"
            min={0}
            disabled={loading}
            value={config.maxAdsPerCycle}
            onChange={(e) =>
              setConfig((c) => ({ ...c, maxAdsPerCycle: clampNonNegativeInt(e.target.value, c.maxAdsPerCycle) }))
            }
            style={inputStyle}
          />
        </label>
        <label className="v3-stack">
          <span>카드 이동 시간(초) — 슬라이드 속도 (5~20, 기본 10)</span>
          <input
            type="number"
            min={5}
            max={20}
            disabled={loading}
            value={config.cardMoveDurationSec}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              setConfig((c) => ({
                ...c,
                cardMoveDurationSec: Number.isFinite(n)
                  ? Math.min(20, Math.max(5, n))
                  : c.cardMoveDurationSec,
              }));
            }}
            style={inputStyle}
          />
        </label>
        <div className="v3-row">
          <button className="v3-btn" type="button" onClick={handleSaveConfig} disabled={loading || savingConfig}>
            {savingConfig ? "설정 저장 중..." : "설정 저장"}
          </button>
        </div>
      </section>

      <section className="v3-box v3-stack">
        <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h2 className="v3-h2" style={{ margin: 0 }}>
            광고 목록
          </h2>
          <button
            className="v3-btn"
            type="button"
            disabled={loading}
            onClick={() => setAds((prev) => [...prev, createEmptyAdRow()])}
          >
            광고 추가
          </button>
        </div>
        {ads.length === 0 ? <p className="v3-muted">등록된 광고가 없습니다. &quot;광고 추가&quot;로 항목을 만드세요.</p> : null}
        {ads.map((row, index) => (
          <div key={row.id} className="v3-box v3-stack" style={{ background: "#fafafa" }}>
            <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                id: {row.id}
              </span>
              <button className="v3-btn" type="button" disabled={loading} onClick={() => void handleSoftDeleteAd(index)}>
                삭제(백업함 이동)
              </button>
            </div>
            <label className="v3-stack">
              <span>광고명 (adName)</span>
              <input
                value={row.adName}
                disabled={loading}
                onChange={(e) => updateAd(index, { adName: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label className="v3-stack">
              <span>업체명 (advertiserName)</span>
              <input
                value={row.advertiserName}
                disabled={loading}
                onChange={(e) => updateAd(index, { advertiserName: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label className="v3-stack">
              <span>이미지 URL * (직접 입력 또는 파일 업로드)</span>
              <input
                value={row.imageUrl}
                disabled={loading}
                onChange={(e) => updateAd(index, { imageUrl: e.target.value })}
                style={inputStyle}
                placeholder="https://... 또는 업로드로 자동 입력"
              />
            </label>
            <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                id={`ad-img-file-${row.id}`}
                style={{ display: "none" }}
                disabled={loading || Boolean(uploadingByAdId[row.id])}
                onChange={(e) => {
                  void handleAdImageUpload(index, e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                className="v3-btn"
                type="button"
                disabled={loading || Boolean(uploadingByAdId[row.id])}
                onClick={() => document.getElementById(`ad-img-file-${row.id}`)?.click()}
              >
                {uploadingByAdId[row.id] ? "업로드 중..." : "이미지 파일 업로드"}
              </button>
              {uploadErrorByAdId[row.id] ? (
                <span style={{ color: "#a33", fontSize: "0.9rem" }}>{uploadErrorByAdId[row.id]}</span>
              ) : null}
            </div>
            <label className="v3-stack">
              <span>외부 링크 *</span>
              <input
                value={row.externalLink}
                disabled={loading}
                onChange={(e) => updateAd(index, { externalLink: e.target.value })}
                style={inputStyle}
                placeholder="https://..."
              />
            </label>
            <label className="v3-row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={row.isActive}
                disabled={loading}
                onChange={(e) => updateAd(index, { isActive: e.target.checked })}
              />
              <span>노출 ON</span>
            </label>
            <label className="v3-stack">
              <span>노출 시작일시 (startAt)</span>
              <input
                type="datetime-local"
                value={isoToDatetimeLocalValue(row.startAt)}
                disabled={loading}
                onChange={(e) => updateAd(index, { startAt: datetimeLocalToIso(e.target.value) })}
                style={inputStyle}
              />
              <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                비우면 시작 시각 제한 없음. 저장 시 UTC ISO 문자열로 전송됩니다.
              </span>
            </label>
            <label className="v3-stack">
              <span>노출 종료일시 (endAt)</span>
              <input
                type="datetime-local"
                value={isoToDatetimeLocalValue(row.endAt)}
                disabled={loading}
                onChange={(e) => updateAd(index, { endAt: datetimeLocalToIso(e.target.value) })}
                style={inputStyle}
              />
              <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                비우면 종료 시각 제한 없음.
              </span>
            </label>
            <div className="v3-stack" style={previewBoxStyle}>
              <strong style={{ fontSize: "0.95rem" }}>미리보기 (관리용)</strong>
              <div style={previewImageWrapStyle}>
                <AdminAdImagePreview imageUrl={row.imageUrl} />
              </div>
              <dl style={{ margin: 0, display: "grid", gap: "0.35rem 0.75rem", fontSize: "0.9rem" }}>
                <dt className="v3-muted" style={{ margin: 0 }}>
                  광고명
                </dt>
                <dd style={{ margin: 0 }}>{row.adName.trim() ? row.adName.trim() : "(없음)"}</dd>
                <dt className="v3-muted" style={{ margin: 0 }}>
                  업체명
                </dt>
                <dd style={{ margin: 0 }}>{row.advertiserName.trim() ? row.advertiserName.trim() : "(없음)"}</dd>
                <dt className="v3-muted" style={{ margin: 0 }}>
                  외부 링크
                </dt>
                <dd style={{ margin: 0, wordBreak: "break-all" }}>
                  {row.externalLink.trim() ? (
                    <>
                      <a
                        href={row.externalLink.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="v3-muted"
                        style={{ color: "#1565c0" }}
                      >
                        링크 열기
                      </a>
                      <span className="v3-muted" style={{ display: "block", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                        {row.externalLink.trim()}
                      </span>
                    </>
                  ) : (
                    <span className="v3-muted">외부 링크 없음</span>
                  )}
                </dd>
                <dt className="v3-muted" style={{ margin: 0 }}>
                  노출 스위치
                </dt>
                <dd style={{ margin: 0 }}>{row.isActive ? "ON" : "OFF"}</dd>
                <dt className="v3-muted" style={{ margin: 0 }}>
                  기간·노출 상태
                </dt>
                <dd style={{ margin: 0 }}>
                  {(() => {
                    const nowMs = Date.now();
                    const sEdge = scheduleEdge(row.startAt);
                    const eEdge = scheduleEdge(row.endAt);
                    const status = adminExposureStatusLabel(row, nowMs);
                    return (
                      <div className="v3-stack" style={{ gap: "0.25rem" }}>
                        <span>
                          시작: {formatScheduleEdgeKo(sEdge)} · 종료: {formatScheduleEdgeKo(eEdge)}
                        </span>
                        <span>
                          <strong>{status}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </dd>
              </dl>
            </div>
            <label className="v3-stack">
              <span>weight</span>
              <input
                type="number"
                min={0}
                disabled={loading}
                value={row.weight}
                onChange={(e) =>
                  updateAd(index, { weight: clampNonNegativeInt(e.target.value, row.weight) })
                }
                style={inputStyle}
              />
            </label>
            <div className="v3-row" style={{ gap: "1.5rem", flexWrap: "wrap" }}>
              <span className="v3-muted">노출수: {row.impressions}</span>
              <span className="v3-muted">클릭수: {row.clicks}</span>
              <span className="v3-muted">CTR: {formatCtr(row.impressions, row.clicks)}</span>
            </div>
          </div>
        ))}
        <div className="v3-row">
          <button className="v3-btn" type="button" onClick={handleSaveAds} disabled={loading || savingAds}>
            {savingAds ? "광고 목록 저장 중..." : "광고 목록 저장"}
          </button>
        </div>
      </section>

      {message ? <p className="v3-muted">{message}</p> : null}
    </main>
  );
}
