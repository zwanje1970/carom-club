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
  accountNumber?: string;
};

export type TournamentFormValues = {
  name: string;
  posterImageUrl: string;
  summary: string;
  status: string;
  entryFee: string | number;
  prizeInfo: string;
  prizeFirst: string;
  prizeSecond: string;
  prizeThird: string;
  prizeThird2: string;
  prizeExtra: string;
  gameFormat: string;
  entryQualificationType: "SCORE" | "EVER";
  entryCondition: string;
  maxParticipants: string | number;
  accountNumber: string;
  scope: "REGIONAL" | "NATIONAL";
  durationType: "1_DAY" | "2_DAYS" | "3_PLUS";
  durationDays: number;
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
  prizeFirst: "",
  prizeSecond: "",
  prizeThird: "",
  prizeThird2: "",
  prizeExtra: "",
  gameFormat: "TOURNAMENT",
  entryQualificationType: "EVER",
  entryCondition: "",
  maxParticipants: "",
  accountNumber: "",
  scope: "REGIONAL",
  durationType: "1_DAY",
  durationDays: 1,
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
    accountNumber: typeof c.accountNumber === "string" ? c.accountNumber : undefined,
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
      if (initialData.prizeInfo) base.prizeExtra = initialData.prizeInfo;
      if (initialData.startAt && initialData.endAt) {
        const s = new Date(initialData.startAt).getTime();
        const e = new Date(initialData.endAt).getTime();
        const days = Math.max(1, Math.round((e - s) / (24 * 60 * 60 * 1000)));
        base.durationDays = days;
      }
      const bc = parseBracketConfig(initialData.rule?.bracketConfig);
      if (bc.scope) base.scope = bc.scope;
      if (bc.gameFormatType) base.gameFormat = bc.gameFormatType;
      if (bc.durationType) base.durationType = bc.durationType;
      if (bc.entryQualificationType) base.entryQualificationType = bc.entryQualificationType;
      if (typeof bc.allowMultipleSlots === "boolean") base.allowMultipleSlots = bc.allowMultipleSlots;
      if (typeof bc.participantsListPublic === "boolean") base.participantsListPublic = bc.participantsListPublic;
      if (bc.accountNumber) base.accountNumber = bc.accountNumber;
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

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const durationType =
      form.durationDays <= 1 ? "1_DAY" : form.durationDays === 2 ? "2_DAYS" : "3_PLUS";
    return {
      scope: form.scope,
      gameFormatType: form.gameFormat as BracketConfigExtra["gameFormatType"],
      allowMultipleSlots: form.allowMultipleSlots,
      participantsListPublic: form.participantsListPublic,
      durationType,
      entryQualificationType: form.entryQualificationType,
      accountNumber: form.accountNumber.trim() || undefined,
    };
  }

  function buildPrizeInfo(): string {
    const parts: string[] = [];
    if (form.prizeFirst.trim()) parts.push(`우승: ${form.prizeFirst.trim()}`);
    if (form.prizeSecond.trim()) parts.push(`준우승: ${form.prizeSecond.trim()}`);
    if (form.prizeThird.trim()) parts.push(`3위: ${form.prizeThird.trim()}`);
    if (form.prizeThird2.trim()) parts.push(`3위: ${form.prizeThird2.trim()}`);
    if (form.prizeExtra.trim()) parts.push(form.prizeExtra.trim());
    return parts.join("\n");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!form.name.trim()) {
      setError("대회명을 입력해 주세요.");
      return;
    }
    if (!form.startAt) {
      setError("경기 일정(시작일시)을 선택해 주세요.");
      return;
    }
    const hasVenue = venues.some((v) => (v.venueName || v.address || "").trim());
    if (!hasVenue) {
      setError("대회장소를 1곳 이상 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const days = Math.max(1, form.durationDays || 1);
      const start = new Date(form.startAt);
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      const endAtIso = end.toISOString().slice(0, 16);
      const payload = {
        ...form,
        endAt: form.endAt || endAtIso,
        prizeInfo: buildPrizeInfo() || form.prizeInfo,
      };
      await onSubmit(payload, getBracketConfig(), venues);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
      {success && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg" role="status">
          저장되었습니다.
        </p>
      )}

      {/* 1. 기본 정보 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">기본 정보</h2>
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
          <label className="block text-sm font-medium text-site-text mb-1">대표 이미지 (선택)</label>
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
          <label className="block text-sm font-medium text-site-text mb-1">대회소개 (선택)</label>
          <textarea
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

      {/* 2. 모집인원 · 참가비 · 계좌번호 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">모집인원 · 참가비 · 계좌번호</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">모집 인원 *</label>
            <input
              type="number"
              min={1}
              required
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="32"
              value={form.maxParticipants === "" ? "" : form.maxParticipants}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxParticipants: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">참가비 (원) *</label>
            <input
              type="number"
              min={0}
              required
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
              value={form.entryFee === "" ? "" : form.entryFee}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryFee: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">계좌번호(은행명, 예금주)</label>
          <input
            type="text"
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="예: 국민은행 123-456-789 예금주명"
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          />
        </div>
      </section>

      {/* 3. 상금 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">상금</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">우승</label>
            <input
              type="text"
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="예: 50만원"
              value={form.prizeFirst}
              onChange={(e) => setForm((f) => ({ ...f, prizeFirst: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">준우승</label>
            <input
              type="text"
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="예: 30만원"
              value={form.prizeSecond}
              onChange={(e) => setForm((f) => ({ ...f, prizeSecond: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">3위</label>
            <input
              type="text"
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="예: 10만원"
              value={form.prizeThird}
              onChange={(e) => setForm((f) => ({ ...f, prizeThird: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">3위</label>
            <input
              type="text"
              className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
              placeholder="예: 10만원"
              value={form.prizeThird2}
              onChange={(e) => setForm((f) => ({ ...f, prizeThird2: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">추가 (자유 입력)</label>
          <textarea
            rows={2}
            className="w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            placeholder="4위 이하, 특별상 등"
            value={form.prizeExtra}
            onChange={(e) => setForm((f) => ({ ...f, prizeExtra: e.target.value }))}
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
          <label className="block text-sm font-medium text-site-text mb-1">대회 기간 (일) *</label>
          <input
            type="number"
            min={1}
            className="w-full max-w-24 border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card"
            value={form.durationDays}
            onChange={(e) =>
              setForm((f) => ({ ...f, durationDays: Math.max(1, parseInt(e.target.value, 10) || 1) }))
            }
          />
          <p className="mt-1 text-xs text-site-text-muted">시작일로부터 며칠 동안인지 입력 (기본값 1)</p>
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-site-text">대회 장소 * (1곳 이상)</label>
            <button
              type="button"
              onClick={() => {
                const nextNum = venues.length ? Math.max(...venues.map((v) => v.venueNumber), 0) + 1 : 1;
                setVenues((prev) => [
                  ...prev,
                  { venueNumber: nextNum, displayLabel: `${nextNum}경기장`, venueName: "", address: "", phone: "" },
                ]);
              }}
              className="rounded-lg border border-site-border px-3 py-1.5 text-sm font-medium text-site-text hover:bg-site-bg"
            >
              대회장소 추가
            </button>
          </div>
          <div className="space-y-3">
            {venues.map((v, idx) => (
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
                {venues.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVenues((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-sm text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 경기요강 (선택) */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">경기요강 (선택)</h2>
        {children}
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:items-center">
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
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
