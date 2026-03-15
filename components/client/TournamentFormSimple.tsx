"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { TOURNAMENT_STATUSES } from "@/types/tournament";

// 경기 방식: 토너먼트 / 스카치 / 서바이벌 / 4구대회
const GAME_FORMAT_OPTIONS = [
  { value: "TOURNAMENT", label: "토너먼트" },
  { value: "SCOTCH", label: "스카치" },
  { value: "SURVIVAL", label: "서바이벌" },
  { value: "FOUR_BALL", label: "4구대회" },
] as const;

const SCOPE_OPTIONS = [
  { value: "REGIONAL", label: "지역대회" },
  { value: "NATIONAL", label: "전국대회" },
] as const;

const DURATION_OPTIONS = [
  { value: "1_DAY", label: "1일" },
  { value: "2_DAYS", label: "2일" },
  { value: "3_PLUS", label: "3일 이상" },
] as const;

const ENTRY_QUALIFICATION_OPTIONS = [
  { value: "SCORE", label: "점수 기준" },
  { value: "EVER", label: "에버 기준" },
] as const;

export type BracketConfigExtra = {
  scope?: "REGIONAL" | "NATIONAL";
  gameFormatType?: "TOURNAMENT" | "SCOTCH" | "SURVIVAL" | "FOUR_BALL";
  allowMultipleSlots?: boolean;
  participantsListPublic?: boolean;
  durationType?: "1_DAY" | "2_DAYS" | "3_PLUS";
  entryQualificationType?: "SCORE" | "EVER";
};

export type TournamentFormValues = {
  name: string;
  posterImageUrl: string;
  summary: string;
  status: string;
  entryFee: string | number;
  prizeInfo: string;
  gameFormat: string;
  entryQualificationType: "SCORE" | "EVER";
  entryCondition: string;
  maxParticipants: string | number;
  scope: "REGIONAL" | "NATIONAL";
  durationType: "1_DAY" | "2_DAYS" | "3_PLUS";
  allowMultipleSlots: boolean;
  participantsListPublic: boolean;
  startAt: string;
  endAt: string;
  venue: string;
  rules: string;
  promoContent: string;
};

const defaultFormValues: TournamentFormValues = {
  name: "",
  posterImageUrl: "",
  summary: "",
  status: "OPEN",
  entryFee: "",
  prizeInfo: "",
  gameFormat: "TOURNAMENT",
  entryQualificationType: "EVER",
  entryCondition: "",
  maxParticipants: "",
  scope: "REGIONAL",
  durationType: "1_DAY",
  allowMultipleSlots: false,
  participantsListPublic: true,
  startAt: "",
  endAt: "",
  venue: "",
  rules: "",
  promoContent: "",
};

function parseBracketConfig(config: unknown): BracketConfigExtra {
  if (!config || typeof config !== "object") return {};
  const c = config as Record<string, unknown>;
  return {
    scope: c.scope as BracketConfigExtra["scope"],
    gameFormatType: c.gameFormatType as BracketConfigExtra["gameFormatType"],
    allowMultipleSlots: c.allowMultipleSlots as boolean | undefined,
    participantsListPublic: c.participantsListPublic as boolean | undefined,
    durationType: c.durationType as BracketConfigExtra["durationType"],
    entryQualificationType: c.entryQualificationType as BracketConfigExtra["entryQualificationType"],
  };
}

type VenueSlot = {
  venueNumber: number;
  displayLabel: string;
  venueName: string;
  address: string;
  phone: string;
};

type TournamentFormSimpleProps = {
  mode: "create" | "edit";
  tournamentId?: string;
  initialData?: Partial<TournamentFormValues> & {
    matchVenues?: { venueNumber: number; displayLabel?: string; venueName?: string; address?: string; phone?: string }[];
    rule?: { bracketConfig?: unknown };
  };
  onSubmit: (values: TournamentFormValues, bracketConfig: BracketConfigExtra, venues: VenueSlot[]) => Promise<void>;
  onCancelHref: string;
  submitLabel?: string;
  children?: React.ReactNode;
};

export function TournamentFormSimple({
  mode,
  tournamentId,
  initialData,
  onSubmit,
  onCancelHref,
  submitLabel,
  children,
}: TournamentFormSimpleProps) {
  const [form, setForm] = useState<TournamentFormValues>(() => {
    const base = { ...defaultFormValues };
    if (initialData) {
      Object.assign(base, {
        name: initialData.name ?? base.name,
        posterImageUrl: initialData.posterImageUrl ?? base.posterImageUrl,
        summary: initialData.summary ?? base.summary,
        status: initialData.status ?? base.status,
        entryFee: initialData.entryFee ?? base.entryFee,
        prizeInfo: initialData.prizeInfo ?? base.prizeInfo,
        gameFormat: initialData.gameFormat ?? base.gameFormat,
        entryCondition: initialData.entryCondition ?? base.entryCondition,
        maxParticipants: initialData.maxParticipants ?? base.maxParticipants,
        startAt: initialData.startAt ?? base.startAt,
        endAt: initialData.endAt ?? base.endAt,
        venue: initialData.venue ?? base.venue,
        rules: initialData.rules ?? base.rules,
        promoContent: initialData.promoContent ?? base.promoContent,
      });
      const bc = parseBracketConfig(initialData.rule?.bracketConfig);
      if (bc.scope) base.scope = bc.scope;
      if (bc.gameFormatType) base.gameFormat = bc.gameFormatType;
      if (bc.durationType) base.durationType = bc.durationType;
      if (bc.entryQualificationType) base.entryQualificationType = bc.entryQualificationType;
      if (typeof bc.allowMultipleSlots === "boolean") base.allowMultipleSlots = bc.allowMultipleSlots;
      if (typeof bc.participantsListPublic === "boolean") base.participantsListPublic = bc.participantsListPublic;
    }
    return base;
  });

  const [venues, setVenues] = useState<VenueSlot[]>(() => {
    const list = initialData?.matchVenues;
    if (list?.length) {
      return list.map((v) => ({
        venueNumber: v.venueNumber,
        displayLabel: v.displayLabel ?? `${v.venueNumber}경기장`,
        venueName: v.venueName ?? "",
        address: v.address ?? "",
        phone: v.phone ?? "",
      }));
    }
    return [{ venueNumber: 1, displayLabel: "1경기장", venueName: "", address: "", phone: "" }];
  });
  const [venueCount, setVenueCount] = useState(initialData?.matchVenues?.length ?? 1);
  const [venueCustomCount, setVenueCustomCount] = useState("");
  const effectiveVenueCount = venueCustomCount !== "" ? (parseInt(venueCustomCount, 10) || 1) : venueCount;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const n = Math.min(32, Math.max(1, effectiveVenueCount));
    setVenues((prev) => {
      if (prev.length === n) return prev;
      const next: VenueSlot[] = [];
      for (let i = 0; i < n; i++) {
        const num = i + 1;
        next.push(
          prev[i]
            ? { ...prev[i], venueNumber: num, displayLabel: prev[i].displayLabel || `${num}경기장` }
            : { venueNumber: num, displayLabel: `${num}경기장`, venueName: "", address: "", phone: "" }
        );
      }
      return next;
    });
  }, [effectiveVenueCount]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("policy", "banner");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setForm((f) => ({ ...f, posterImageUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function getBracketConfig(): BracketConfigExtra {
    return {
      scope: form.scope,
      gameFormatType: form.gameFormat as BracketConfigExtra["gameFormatType"],
      allowMultipleSlots: form.allowMultipleSlots,
      participantsListPublic: form.participantsListPublic,
      durationType: form.durationType,
      entryQualificationType: form.entryQualificationType,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!form.name.trim()) {
      setError("대회명을 입력해 주세요.");
      return;
    }
    if (!form.posterImageUrl.trim()) {
      setError("대표 이미지를 등록해 주세요.");
      return;
    }
    if (!form.summary.trim()) {
      setError("대회 소개를 입력해 주세요.");
      return;
    }
    if (!form.startAt) {
      setError("경기 일정(시작일시)을 선택해 주세요.");
      return;
    }
    if (!form.venue.trim()) {
      setError("대회 장소를 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form, getBracketConfig(), venues);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg" role="status">
          저장되었습니다.
        </p>
      )}

      {/* 1. 기본·홍보 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">기본 정보 · 홍보</h2>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대회명 *</label>
          <input
            type="text"
            required
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card focus:ring-2 focus:ring-site-primary focus:border-transparent"
            placeholder="예: 2025 봄맞이 3구 대회"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대표 이미지 *</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className="border-2 border-dashed border-site-border rounded-lg p-6 text-center cursor-pointer hover:bg-site-bg/50 focus:outline-none focus:ring-2 focus:ring-site-primary"
          >
            {form.posterImageUrl ? (
              <img src={form.posterImageUrl} alt="대표 이미지" className="max-h-40 mx-auto rounded object-contain" />
            ) : (
              <span className="text-site-text-muted text-sm">
                {uploading ? "업로드 중..." : "클릭해서 이미지 선택"}
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대회 소개 *</label>
          <textarea
            required
            rows={3}
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card focus:ring-2 focus:ring-site-primary focus:border-transparent"
            placeholder="대회를 한 줄로 소개해 주세요."
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">상태</label>
          <select
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {TOURNAMENT_STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 2. 참가·경기 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">참가 · 경기</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">참가비 (원) *</label>
            <input
              type="number"
              min={0}
              required
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="0"
              value={form.entryFee === "" ? "" : form.entryFee}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryFee: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">모집 인원 *</label>
            <input
              type="number"
              min={1}
              required
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="32"
              value={form.maxParticipants === "" ? "" : form.maxParticipants}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxParticipants: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">상금 *</label>
          <input
            type="text"
            required
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="예: 1등 50만원, 2등 30만원"
            value={form.prizeInfo}
            onChange={(e) => setForm((f) => ({ ...f, prizeInfo: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">경기 방식 *</label>
          <div className="flex flex-wrap gap-2">
            {GAME_FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  form.gameFormat === opt.value
                    ? "bg-site-primary text-white"
                    : "bg-site-bg text-site-text border border-site-border hover:bg-site-border/30"
                }`}
                onClick={() => setForm((f) => ({ ...f, gameFormat: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">참가 조건 *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {ENTRY_QUALIFICATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  form.entryQualificationType === opt.value
                    ? "bg-site-primary text-white"
                    : "bg-site-bg text-site-text border border-site-border"
                }`}
                onClick={() => setForm((f) => ({ ...f, entryQualificationType: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            required
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="예: 에버 0.5 미만 / 점수 10점 이상"
            value={form.entryCondition}
            onChange={(e) => setForm((f) => ({ ...f, entryCondition: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">지역 / 전국 *</label>
          <div className="flex gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium ${
                  form.scope === opt.value
                    ? "bg-site-primary text-white"
                    : "bg-site-bg text-site-text border border-site-border"
                }`}
                onClick={() => setForm((f) => ({ ...f, scope: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대회 기간 *</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  form.durationType === opt.value
                    ? "bg-site-primary text-white"
                    : "bg-site-bg text-site-text border border-site-border"
                }`}
                onClick={() => setForm((f) => ({ ...f, durationType: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowMultiple"
              className="rounded border-site-border text-site-primary focus:ring-site-primary"
              checked={form.allowMultipleSlots}
              onChange={(e) => setForm((f) => ({ ...f, allowMultipleSlots: e.target.checked }))}
            />
            <label htmlFor="allowMultiple" className="text-sm text-site-text">
              중복 참가 허용
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="participantsListPublic"
              className="rounded border-site-border text-site-primary focus:ring-site-primary"
              checked={form.participantsListPublic}
              onChange={(e) => setForm((f) => ({ ...f, participantsListPublic: e.target.checked }))}
            />
            <label htmlFor="participantsListPublic" className="text-sm text-site-text">
              참가자 명단 공개
            </label>
          </div>
        </div>
      </section>

      {/* 3. 일정 · 장소 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">일정 · 장소</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">시작 일시 *</label>
            <input
              type="datetime-local"
              required
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">종료 일시</label>
            <input
              type="datetime-local"
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대회 장소 *</label>
          <input
            type="text"
            required
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="예: ○○당구장"
            value={form.venue}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
          />
        </div>

        {mode === "edit" && (
          <>
            <div>
              <label className="block text-sm font-medium text-site-text mb-1">경기장 수</label>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 4, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      venueCount === n && !venueCustomCount ? "bg-site-primary text-white" : "bg-site-bg text-site-text border border-site-border"
                    }`}
                    onClick={() => {
                      setVenueCount(n);
                      setVenueCustomCount("");
                    }}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={32}
                  placeholder="직접"
                  className="w-20 border border-site-border rounded px-2 py-1.5 text-sm"
                  value={venueCustomCount}
                  onChange={(e) => {
                    setVenueCustomCount(e.target.value);
                    if (e.target.value) setVenueCount(1);
                  }}
                />
              </div>
            </div>
            <div className="space-y-3">
              {venues.slice(0, Math.min(32, Math.max(1, effectiveVenueCount))).map((v, idx) => (
                <div key={v.venueNumber} className="rounded-lg border border-site-border p-3 space-y-2 bg-site-bg/30">
                  <div className="font-medium text-site-text text-sm">{v.displayLabel}</div>
                  <input
                    type="text"
                    className="w-full border border-site-border rounded px-3 py-2 text-sm"
                    placeholder="경기장명"
                    value={v.venueName}
                    onChange={(e) =>
                      setVenues((prev) => {
                        const next = [...prev];
                        if (next[idx]) next[idx] = { ...next[idx], venueName: e.target.value };
                        return next;
                      })
                    }
                  />
                  <input
                    type="text"
                    className="w-full border border-site-border rounded px-3 py-2 text-sm"
                    placeholder="주소"
                    value={v.address}
                    onChange={(e) =>
                      setVenues((prev) => {
                        const next = [...prev];
                        if (next[idx]) next[idx] = { ...next[idx], address: e.target.value };
                        return next;
                      })
                    }
                  />
                  <input
                    type="text"
                    className="w-full border border-site-border rounded px-3 py-2 text-sm"
                    placeholder="전화"
                    value={v.phone}
                    onChange={(e) =>
                      setVenues((prev) => {
                        const next = [...prev];
                        if (next[idx]) next[idx] = { ...next[idx], phone: e.target.value };
                        return next;
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 경기 요강 · 홍보 (접기 가능한 선택) */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">추가 정보 (선택)</h2>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">경기 요강</label>
          <textarea
            rows={2}
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="경기 규칙 요약"
            value={form.rules}
            onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
          />
        </div>
        {children}
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <Link
          href={onCancelHref}
          className="rounded-lg border border-site-border px-5 py-2.5 font-medium text-site-text hover:bg-site-bg text-center"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "저장 중..." : submitLabel ?? (mode === "create" ? "등록" : "저장")}
        </button>
      </div>
    </form>
  );
}
