"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { DEFAULT_ADMIN_COPY, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import {
  DIVISION_METRIC_TYPE_FORM_OPTIONS,
  ELIGIBILITY_TYPE_FORM_OPTIONS,
  VERIFICATION_MODE_FORM_OPTIONS,
  parseDivisionRulesJson,
  type DivisionRule,
  type DivisionMetricType,
  type EligibilityType,
  type VerificationMode,
} from "@/lib/tournament-certification";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import { processImage } from "@/lib/process-image.client";
import { formatKoreanSchedule } from "@/lib/format-date";

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

/** datetime-local 문자열 → 날짜·시각 분리 (브라우저 기본 달력은 날짜만 빠르게 확정되도록 분리 입력용) */
function splitDatetimeLocal(iso: string): { date: string; time: string } {
  if (!iso || typeof iso !== "string") return { date: "", time: "" };
  const s = iso.trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[Tt](\d{1,2}):(\d{2})/);
  if (m) {
    const hh = m[2].padStart(2, "0");
    return { date: m[1], time: `${hh}:${m[3]}` };
  }
  const dm = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dm) return { date: dm[1], time: "09:00" };
  return { date: "", time: "" };
}

function joinDatetimeLocal(date: string, time: string): string {
  const d = date.trim();
  if (!d) return "";
  const tRaw = time.trim();
  const tm = tRaw.match(/^(\d{1,2}):(\d{2})$/);
  const t = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : "09:00";
  return `${d}T${t}`;
}

const ENTRY_QUALIFICATION_OPTIONS = [
  { value: "SCORE", label: "점수 기준" },
  { value: "EVER", label: "에버 기준" },
  { value: "NONE", label: "상관없음" },
] as const;

export type BracketConfigExtra = {
  scope?: "REGIONAL" | "NATIONAL";
  gameFormatType?: "TOURNAMENT" | "SCOTCH" | "SURVIVAL" | "FOUR_BALL";
  allowMultipleSlots?: boolean;
  participantsListPublic?: boolean;
  durationType?: "1_DAY" | "2_DAYS" | "3_PLUS";
  entryQualificationType?: "SCORE" | "EVER" | "NONE";
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
  isScotch: boolean;
  teamScoreLimit: string | number;
  teamScoreRule: "LTE" | "LT";
  entryQualificationType: "SCORE" | "EVER" | "NONE";
  entryCondition: string;
  maxParticipants: string | number;
  accountNumber: string;
  scope: "REGIONAL" | "NATIONAL";
  durationType: "1_DAY" | "2_DAYS" | "3_PLUS";
  durationDays: number;
  allowMultipleSlots: boolean;
  participantsListPublic: boolean;
  verificationMode: VerificationMode;
  verificationReviewRequired: boolean;
  eligibilityType: EligibilityType;
  eligibilityValue: string;
  verificationGuideText: string;
  divisionEnabled: boolean;
  divisionMetricType: DivisionMetricType;
  divisionRules: DivisionRule[];
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
  isScotch: false,
  teamScoreLimit: "",
  teamScoreRule: "LTE",
  entryQualificationType: "EVER",
  entryCondition: "",
  maxParticipants: "",
  accountNumber: "",
  scope: "REGIONAL",
  durationType: "1_DAY",
  durationDays: 1,
  allowMultipleSlots: false,
  participantsListPublic: true,
  verificationMode: "NONE",
  verificationReviewRequired: true,
  eligibilityType: "NONE",
  eligibilityValue: "",
  verificationGuideText: "",
  divisionEnabled: false,
  divisionMetricType: "AVERAGE",
  divisionRules: [],
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
  /** site: 기존 마이페이지 톤 · console: /client 운영 콘솔(좁은 radius·zinc) */
  appearance?: "site" | "console";
  /** true: 취소 옆에 임시저장(DRAFT 상태로 제출) */
  showDraftSaveButton?: boolean;
  initialData?: Partial<TournamentFormValues> & {
    matchVenues?: { venueNumber: number; displayLabel?: string; venueName?: string; address?: string; phone?: string }[];
    rule?: { bracketConfig?: unknown };
    verificationMode?: VerificationMode;
    verificationReviewRequired?: boolean;
    eligibilityType?: EligibilityType;
    eligibilityValue?: number | string | null;
    verificationGuideText?: string | null;
    divisionEnabled?: boolean;
    divisionMetricType?: DivisionMetricType;
    divisionRulesJson?: unknown;
  };
  defaultVenueInfo?: {
    venueName?: string;
    address?: string;
    phone?: string;
    organizerName?: string;
  };
  onSubmit: (values: TournamentFormValues, bracketConfig: BracketConfigExtra, venues: VenueSlot[]) => Promise<void>;
  onCancelHref: string;
  submitLabel?: string;
  children?: React.ReactNode;
};

export function TournamentFormSimple({
  mode,
  tournamentId,
  appearance = "site",
  showDraftSaveButton = false,
  initialData,
  defaultVenueInfo,
  onSubmit,
  onCancelHref,
  submitLabel,
  children,
}: TournamentFormSimpleProps) {
  const isConsole = appearance === "console";
  const chrome = isConsole
    ? {
        form: "space-y-4",
        section:
          "rounded-sm border border-zinc-300 bg-white p-3 sm:p-4 space-y-3 dark:border-zinc-700 dark:bg-zinc-900",
        sectionTitle:
          "text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-300 pb-2 dark:border-zinc-600",
        input:
          "w-full border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-500",
        inputNum:
          "w-full border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        select:
          "w-full border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 rounded-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100",
        dropzone:
          "border border-dashed border-zinc-400 rounded-sm p-5 text-center cursor-pointer text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-zinc-400",
        venueCard: "rounded-sm border border-zinc-300 p-3 space-y-2 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-800/30",
        venueInput: "w-full border border-zinc-300 rounded-sm px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950",
        pillOff:
          "bg-zinc-100 text-zinc-800 border border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600",
        pillOn: "bg-zinc-800 text-white border border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200",
        linkBtn:
          "rounded-sm border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 text-center dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800",
        submitBtn:
          "rounded-sm border border-zinc-800 bg-zinc-800 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-900 disabled:opacity-50 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
        addVenueBtn:
          "rounded-sm border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800",
        label: "block text-xs font-medium text-zinc-700 mb-1 dark:text-zinc-300",
        pillPrimary: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
        muted: "text-xs text-zinc-500 dark:text-zinc-500",
        venueTitle: "font-medium text-zinc-900 text-xs dark:text-zinc-100",
        checkbox: "rounded border-zinc-400 text-zinc-800 focus:ring-zinc-400 dark:border-zinc-600",
        inlineLabel: "text-xs text-zinc-800 dark:text-zinc-200",
      }
    : {
        form: "space-y-6 max-w-xl mx-auto",
        section: "rounded-xl border border-site-border bg-site-card p-4 sm:p-5 space-y-4",
        sectionTitle: "text-base font-semibold text-site-text border-b border-site-border pb-2",
        input:
          "w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card focus:ring-2 focus:ring-site-primary focus:border-transparent",
        inputNum:
          "w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        select: "w-full border border-site-border rounded-lg px-3 py-2.5 text-site-text bg-site-card",
        dropzone:
          "border-2 border-dashed border-site-border rounded-lg p-6 text-center cursor-pointer hover:bg-site-bg/50 focus:outline-none focus:ring-2 focus:ring-site-primary",
        venueCard: "rounded-lg border border-site-border p-3 space-y-2 bg-site-bg/30",
        venueInput: "w-full border border-site-border rounded px-3 py-2 text-sm",
        pillOff: "bg-site-bg text-site-text border border-site-border hover:bg-site-border/30",
        pillOn: "bg-site-bg text-site-text border border-site-border",
        linkBtn:
          "rounded-lg border border-site-border px-5 py-2.5 font-medium text-site-text hover:bg-site-bg text-center",
        submitBtn:
          "rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50",
        addVenueBtn:
          "rounded-lg border border-site-border px-3 py-1.5 text-sm font-medium text-site-text hover:bg-site-bg",
        label: "block text-sm font-medium text-site-text mb-1",
        pillPrimary: "bg-site-primary text-white",
        muted: "text-xs text-site-text-muted",
        venueTitle: "font-medium text-site-text text-sm",
        checkbox: "rounded border-site-border text-site-primary focus:ring-site-primary",
        inlineLabel: "text-sm text-site-text",
      };
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
      if (typeof initialData.isScotch === "boolean") base.isScotch = initialData.isScotch;
      if (initialData.teamScoreLimit != null && initialData.teamScoreLimit !== "") {
        base.teamScoreLimit = initialData.teamScoreLimit;
      }
      if (initialData.teamScoreRule) base.teamScoreRule = initialData.teamScoreRule;
      if (initialData.verificationMode) base.verificationMode = initialData.verificationMode;
      if (typeof initialData.verificationReviewRequired === "boolean") {
        base.verificationReviewRequired = initialData.verificationReviewRequired;
      }
      if (initialData.eligibilityType) base.eligibilityType = initialData.eligibilityType;
      if (initialData.eligibilityValue != null && initialData.eligibilityValue !== "") {
        base.eligibilityValue = String(initialData.eligibilityValue);
      }
      if (typeof initialData.verificationGuideText === "string") {
        base.verificationGuideText = initialData.verificationGuideText;
      }
      if (typeof initialData.divisionEnabled === "boolean") {
        base.divisionEnabled = initialData.divisionEnabled;
      }
      if (initialData.divisionMetricType) {
        base.divisionMetricType = initialData.divisionMetricType;
      }
      const parsedDivisionRules = parseDivisionRulesJson(initialData.divisionRulesJson);
      if (parsedDivisionRules.length > 0) base.divisionRules = parsedDivisionRules;
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
  const submitAsDraftRef = useRef(false);
  const showScotchFields = form.gameFormat === "SCOTCH" || form.isScotch;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 2200);
    return () => clearTimeout(t);
  }, [success]);

  function applyDefaultVenueInfo() {
    const nextVenueName = (defaultVenueInfo?.venueName ?? "").trim();
    const nextAddress = (defaultVenueInfo?.address ?? "").trim();
    const nextPhone = (defaultVenueInfo?.phone ?? "").trim();
    const hasAnyDefault = Boolean(nextVenueName || nextAddress || nextPhone);
    if (!hasAnyDefault) {
      setError("불러올 기본정보가 없습니다.");
      return;
    }
    setError("");
    setVenues((prev) => {
      if (prev.length === 0) {
        return [
          {
            venueNumber: 1,
            displayLabel: "1경기장",
            venueName: nextVenueName,
            address: nextAddress,
            phone: nextPhone,
          },
        ];
      }
      const next = [...prev];
      next[0] = {
        ...next[0],
        venueName: nextVenueName,
        address: nextAddress,
        phone: nextPhone,
      };
      return next;
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;
    const imageFiles = selectedFiles.filter(
      (file) => typeof file.type === "string" && file.type.startsWith("image/")
    );
    if (imageFiles.length === 0) {
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const processedList = await Promise.all(imageFiles.map((file) => processImage(file)));
      const uploadedUrls = await Promise.all(
        processedList.map(async ({ main, thumbnail }) => {
          const fd = new FormData();
          fd.append("file", main);
          fd.append("thumbnail", thumbnail);
          fd.append("policy", "banner");
          const res = await fetch("/api/admin/upload-image", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "업로드 실패");
          return typeof data.url === "string" ? data.url : "";
        })
      );
      const primaryUrl = uploadedUrls.find((url) => url.trim());
      if (!primaryUrl) throw new Error("업로드 결과 URL이 없습니다.");
      setForm((f) => ({ ...f, posterImageUrl: primaryUrl }));
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
    const asDraft = submitAsDraftRef.current;
    submitAsDraftRef.current = false;
    if (!form.name.trim()) {
      setError("대회명을 입력해 주세요.");
      return;
    }
    if (!form.startAt) {
      setError("경기 일정(시작일시)을 선택해 주세요.");
      return;
    }
    if (form.entryQualificationType === "SCORE" || form.entryQualificationType === "EVER") {
      if (!form.entryCondition.trim()) {
        setError("참가 조건(점수·에버 설명)을 입력해 주세요.");
        return;
      }
    }
    if (form.eligibilityType === "UNDER") {
      const v = form.eligibilityValue.trim();
      const n = Number.parseFloat(v.replace(",", "."));
      if (!Number.isFinite(n)) {
        setError("참가 제한 기준 에버를 입력해 주세요.");
        return;
      }
    }
    if (form.divisionEnabled && form.divisionRules.length === 0) {
      setError("자동 부 분배를 사용하려면 부 규칙을 1개 이상 추가해 주세요.");
      return;
    }
    if (showScotchFields) {
      const limitValue = form.teamScoreLimit === "" ? null : Number(form.teamScoreLimit);
      if (!Number.isFinite(limitValue ?? Number.NaN)) {
        setError("스카치 대회는 팀 점수 제한을 입력해 주세요.");
        return;
      }
    }
    const hasVenue = venues.some((v) => (v.venueName || v.address || "").trim());
    if (!asDraft && !hasVenue) {
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
        status: asDraft ? "DRAFT" : form.status,
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

  const formDomId = tournamentId ? `tournament-form-${tournamentId}` : "tournament-form-new";

  return (
    <form id={formDomId} onSubmit={handleSubmit} className={chrome.form}>

      {/* 1. 기본 정보 */}
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>기본 정보</h2>
        <div>
          <label className={chrome.label}>대회명 *</label>
          <input
            type="text"
            required
            className={chrome.input}
            placeholder="예: 2025 봄맞이 3구 대회"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className={chrome.label}>대표 이미지 (선택)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={chrome.dropzone}
          >
            {form.posterImageUrl ? (
              <img src={form.posterImageUrl} alt="대표 이미지" className="max-h-40 mx-auto rounded object-contain" />
            ) : (
              <span className={chrome.muted}>
                {uploading ? "업로드 중..." : "클릭해서 이미지 선택"}
              </span>
            )}
          </div>
        </div>
        <div>
          <label className={chrome.label}>대회소개 (선택)</label>
          <textarea
            rows={3}
            className={chrome.input}
            placeholder="대회를 한 줄로 소개해 주세요."
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
        </div>
        <div>
          <label className={chrome.label}>상태</label>
          <select
            className={chrome.select}
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
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>모집인원 · 참가비 · 계좌번호</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={chrome.label}>모집 인원 *</label>
            <input
              type="number"
              min={1}
              required
              className={chrome.inputNum}
              placeholder="32"
              value={form.maxParticipants === "" ? "" : form.maxParticipants}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxParticipants: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className={chrome.label}>참가비 (원) *</label>
            <input
              type="number"
              min={0}
              required
              className={chrome.inputNum}
              placeholder="0"
              value={form.entryFee === "" ? "" : form.entryFee}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryFee: e.target.value === "" ? "" : Number(e.target.value) }))
              }
            />
          </div>
        </div>
        <div>
          <label className={chrome.label}>계좌번호(은행명, 예금주)</label>
          <input
            type="text"
            className={chrome.select}
            placeholder="예: 국민은행 123-456-789 예금주명"
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          />
        </div>
      </section>

      {/* 3. 상금 */}
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>상금</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={chrome.label}>우승</label>
            <input
              type="text"
              className={chrome.select}
              placeholder="예: 50만원"
              value={form.prizeFirst}
              onChange={(e) => setForm((f) => ({ ...f, prizeFirst: e.target.value }))}
            />
          </div>
          <div>
            <label className={chrome.label}>준우승</label>
            <input
              type="text"
              className={chrome.select}
              placeholder="예: 30만원"
              value={form.prizeSecond}
              onChange={(e) => setForm((f) => ({ ...f, prizeSecond: e.target.value }))}
            />
          </div>
          <div>
            <label className={chrome.label}>3위</label>
            <input
              type="text"
              className={chrome.select}
              placeholder="예: 10만원"
              value={form.prizeThird}
              onChange={(e) => setForm((f) => ({ ...f, prizeThird: e.target.value }))}
            />
          </div>
          <div>
            <label className={chrome.label}>3위</label>
            <input
              type="text"
              className={chrome.select}
              placeholder="예: 10만원"
              value={form.prizeThird2}
              onChange={(e) => setForm((f) => ({ ...f, prizeThird2: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className={chrome.label}>추가 (자유 입력)</label>
          <textarea
            rows={2}
            className={chrome.select}
            placeholder="4위 이하, 특별상 등"
            value={form.prizeExtra}
            onChange={(e) => setForm((f) => ({ ...f, prizeExtra: e.target.value }))}
          />
        </div>
        <div>
          <label className={chrome.label}>경기 방식 *</label>
          <div className="flex flex-wrap gap-2">
            {GAME_FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  form.gameFormat === opt.value
                    ? chrome.pillPrimary
                    : chrome.pillOff
                }`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    gameFormat: opt.value,
                    isScotch: opt.value === "SCOTCH",
                  }))
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {showScotchFields && (
          <div className="rounded-lg border border-site-border bg-site-bg/50 p-3 space-y-3">
            <h3 className="text-sm font-semibold text-site-text">스카치 설정</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={chrome.label}>팀 점수 제한 *</label>
                <input
                  type="number"
                  min={0}
                  className={chrome.inputNum}
                  placeholder="예: 50"
                  value={form.teamScoreLimit === "" ? "" : form.teamScoreLimit}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      teamScoreLimit: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className={chrome.label}>비교 방식</label>
                <div className="flex gap-2">
                  {[
                    { value: "LTE", label: "이하(<=)" },
                    { value: "LT", label: "미만(<)" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        form.teamScoreRule === opt.value ? chrome.pillPrimary : chrome.pillOff
                      }`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          teamScoreRule: opt.value as "LTE" | "LT",
                        }))
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className={chrome.muted}>스카치 대회는 참가 신청 시 2인 팀 점수 합으로 자동 검증됩니다.</p>
          </div>
        )}
        <div>
          <label className={chrome.label}>참가 조건 *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {ENTRY_QUALIFICATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  form.entryQualificationType === opt.value
                    ? chrome.pillPrimary
                    : chrome.pillOff
                }`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    entryQualificationType: opt.value,
                    entryCondition: opt.value === "NONE" ? "" : f.entryCondition,
                  }))
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.entryQualificationType === "NONE" ? (
            <p className={`rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200`}>
              참가 신청에 점수·에버 조건을 적용하지 않습니다.
            </p>
          ) : (
            <input
              type="text"
              required
              className={chrome.select}
              placeholder="예: 에버 0.5 미만 / 점수 10점 이상"
              value={form.entryCondition}
              onChange={(e) => setForm((f) => ({ ...f, entryCondition: e.target.value }))}
            />
          )}
        </div>
        <div>
          <label className={chrome.label}>지역 / 전국 *</label>
          <div className="flex gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium ${
                  form.scope === opt.value
                    ? chrome.pillPrimary
                    : chrome.pillOff
                }`}
                onClick={() => setForm((f) => ({ ...f, scope: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={chrome.label}>대회 기간 (일) *</label>
          <input
            type="number"
            min={1}
            className={`w-full max-w-24 ${chrome.inputNum}`}
            value={form.durationDays}
            onChange={(e) =>
              setForm((f) => ({ ...f, durationDays: Math.max(1, parseInt(e.target.value, 10) || 1) }))
            }
          />
          <p className={`mt-1 ${chrome.muted}`}>시작일로부터 며칠 동안인지 입력 (기본값 1)</p>
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
            <label htmlFor="allowMultiple" className={chrome.inlineLabel}>
              중복 참가 허용
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="participantsListPublic"
              className={chrome.checkbox}
              checked={form.participantsListPublic}
              onChange={(e) => setForm((f) => ({ ...f, participantsListPublic: e.target.checked }))}
            />
            <label htmlFor="participantsListPublic" className={chrome.inlineLabel}>
              참가자 명단 공개
            </label>
          </div>
        </div>
      </section>

      {/* 인증파일 요청 · 참가 제한 */}
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>
          {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.sectionCert")}
        </h2>
        <div>
          <label className={chrome.label}>{getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.certMode.label")}</label>
          <div className="flex flex-wrap gap-2">
            {VERIFICATION_MODE_FORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  form.verificationMode === opt.value ? chrome.pillPrimary : chrome.pillOff
                }`}
                onClick={() => setForm((f) => ({ ...f, verificationMode: opt.value }))}
              >
                {getCopyValue(DEFAULT_ADMIN_COPY, opt.labelKey as AdminCopyKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="verificationReviewRequired"
            className={chrome.checkbox}
            checked={form.verificationReviewRequired}
            onChange={(e) => setForm((f) => ({ ...f, verificationReviewRequired: e.target.checked }))}
          />
          <div>
            <label htmlFor="verificationReviewRequired" className={chrome.inlineLabel}>
              {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.manualReview.label")}
            </label>
            <p className={`mt-0.5 ${chrome.muted}`}>
              {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.manualReview.hint")}
            </p>
          </div>
        </div>
        <div>
          <label className={chrome.label}>
            {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.verificationGuide.label")}
          </label>
          <textarea
            rows={2}
            className={chrome.select}
            value={form.verificationGuideText}
            onChange={(e) => setForm((f) => ({ ...f, verificationGuideText: e.target.value }))}
            placeholder={getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.verificationGuide.placeholder")}
          />
        </div>
        <div>
          <label className={chrome.label}>{getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.eligibility.label")}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {ELIGIBILITY_TYPE_FORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  form.eligibilityType === opt.value ? chrome.pillPrimary : chrome.pillOff
                }`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    eligibilityType: opt.value,
                    eligibilityValue: opt.value === "NONE" ? "" : f.eligibilityValue,
                  }))
                }
              >
                {getCopyValue(DEFAULT_ADMIN_COPY, opt.labelKey as AdminCopyKey)}
              </button>
            ))}
          </div>
          {form.eligibilityType === "UNDER" && (
            <input
              type="text"
              inputMode="decimal"
              className={chrome.select}
              placeholder={getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.eligibility.valuePlaceholder")}
              value={form.eligibilityValue}
              onChange={(e) => setForm((f) => ({ ...f, eligibilityValue: e.target.value }))}
            />
          )}
        </div>
        <div className="space-y-2 rounded-sm border border-zinc-300 p-3 dark:border-zinc-600">
          <div>
            <label className={chrome.label}>
              {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.metric.label")}
            </label>
            <div className="flex flex-wrap gap-2">
              {DIVISION_METRIC_TYPE_FORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    form.divisionMetricType === opt.value ? chrome.pillPrimary : chrome.pillOff
                  }`}
                  onClick={() => setForm((f) => ({ ...f, divisionMetricType: opt.value }))}
                >
                  {getCopyValue(DEFAULT_ADMIN_COPY, opt.labelKey as AdminCopyKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="divisionEnabled"
              type="checkbox"
              className={chrome.checkbox}
              checked={form.divisionEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  divisionEnabled: e.target.checked,
                  divisionRules: e.target.checked ? f.divisionRules : [],
                }))
              }
            />
            <label htmlFor="divisionEnabled" className={chrome.inlineLabel}>
              {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.enabled")}
            </label>
          </div>
          {form.divisionEnabled && (
            <div className="space-y-2">
              {form.divisionRules.map((rule, idx) => (
                <div key={`${idx}-${rule.name}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
                  <input
                    type="text"
                    className={chrome.select}
                    placeholder={getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.namePlaceholder")}
                    value={rule.name}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.divisionRules];
                        if (!next[idx]) return f;
                        next[idx] = { ...next[idx], name: e.target.value };
                        return { ...f, divisionRules: next };
                      })
                    }
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className={chrome.select}
                    placeholder={getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.minPlaceholder")}
                    value={rule.min == null ? "" : String(rule.min)}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.divisionRules];
                        if (!next[idx]) return f;
                        const val = e.target.value.trim();
                        const parsed = val === "" ? null : Number.parseFloat(val);
                        next[idx] = { ...next[idx], min: parsed != null && Number.isFinite(parsed) ? parsed : null };
                        return { ...f, divisionRules: next };
                      })
                    }
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className={chrome.select}
                    placeholder={getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.maxPlaceholder")}
                    value={rule.max == null ? "" : String(rule.max)}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.divisionRules];
                        if (!next[idx]) return f;
                        const val = e.target.value.trim();
                        const parsed = val === "" ? null : Number.parseFloat(val);
                        next[idx] = { ...next[idx], max: parsed != null && Number.isFinite(parsed) ? parsed : null };
                        return { ...f, divisionRules: next };
                      })
                    }
                  />
                  <button
                    type="button"
                    className="rounded-sm border border-red-300 px-2 py-1 text-xs text-red-700"
                    onClick={() =>
                      setForm((f) => ({ ...f, divisionRules: f.divisionRules.filter((_, i) => i !== idx) }))
                    }
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={chrome.addVenueBtn}
                onClick={() =>
                  setForm((f) => ({ ...f, divisionRules: [...f.divisionRules, { name: "", min: null, max: null }] }))
                }
              >
                {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.add")}
              </button>
              <p className={chrome.muted}>
                {getCopyValue(DEFAULT_ADMIN_COPY, "client.tournamentForm.division.ruleHint")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. 일정 · 장소 */}
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>일정 · 장소</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-800/40">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">시작 일시 *</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={`${chrome.label} !mb-0.5 text-[11px]`}>시작 날짜</label>
                  <input
                    type="date"
                    required
                    className={`${chrome.select} ${splitDatetimeLocal(form.startAt).date ? "ring-2 ring-site-primary/40 dark:ring-site-primary/50" : ""}`}
                    value={splitDatetimeLocal(form.startAt).date}
                    onChange={(e) => {
                      const nd = e.target.value;
                      setForm((f) => {
                        const prev = splitDatetimeLocal(f.startAt);
                        return { ...f, startAt: joinDatetimeLocal(nd, prev.time || "09:00") };
                      });
                    }}
                  />
                </div>
                <div>
                  <label className={`${chrome.label} !mb-0.5 text-[11px]`}>시작 시각</label>
                  <input
                    type="time"
                    step={60}
                    className={chrome.select}
                    value={splitDatetimeLocal(form.startAt).time}
                    onChange={(e) => {
                      const nt = e.target.value;
                      setForm((f) => {
                        const prev = splitDatetimeLocal(f.startAt);
                        if (!prev.date) return f;
                        return { ...f, startAt: joinDatetimeLocal(prev.date, nt) };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-900">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">종료 일시</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={`${chrome.label} !mb-0.5 text-[11px]`}>종료 날짜</label>
                  <input
                    type="date"
                    className={`${chrome.select} ${splitDatetimeLocal(form.endAt).date ? "ring-2 ring-amber-400/70 dark:ring-amber-500/50" : ""}`}
                    value={splitDatetimeLocal(form.endAt).date}
                    onChange={(e) => {
                      const nd = e.target.value;
                      setForm((f) => {
                        const prev = splitDatetimeLocal(f.endAt);
                        return { ...f, endAt: nd ? joinDatetimeLocal(nd, prev.time || "18:00") : "" };
                      });
                    }}
                  />
                </div>
                <div>
                  <label className={`${chrome.label} !mb-0.5 text-[11px]`}>종료 시각</label>
                  <input
                    type="time"
                    step={60}
                    className={chrome.select}
                    value={splitDatetimeLocal(form.endAt).time}
                    onChange={(e) => {
                      const nt = e.target.value;
                      setForm((f) => {
                        const prev = splitDatetimeLocal(f.endAt);
                        if (!prev.date) return f;
                        return { ...f, endAt: joinDatetimeLocal(prev.date, nt) };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            role="status"
            aria-live="polite"
          >
            {form.startAt ? (
              <p>
                <span className="font-semibold text-site-primary">시작</span>{" "}
                {formatKoreanSchedule(form.startAt)}
              </p>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">시작 날짜를 선택하면 여기에 표시됩니다.</p>
            )}
            {form.endAt ? (
              <p className="mt-1">
                <span className="font-semibold text-amber-700 dark:text-amber-400">종료</span>{" "}
                {formatKoreanSchedule(form.endAt)}
              </p>
            ) : form.startAt ? (
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">종료는 비워 두면 저장 시 대회 기간(일)으로 자동 계산됩니다.</p>
            ) : null}
            {form.startAt && form.endAt ? (
              <p className="mt-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                구간: {formatKoreanSchedule(form.startAt, form.endAt)}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={chrome.label}>대회 장소 * (1곳 이상)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyDefaultVenueInfo}
                className={chrome.addVenueBtn}
              >
                기본정보 불러오기
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextNum = venues.length ? Math.max(...venues.map((v) => v.venueNumber), 0) + 1 : 1;
                  setVenues((prev) => [
                    ...prev,
                    { venueNumber: nextNum, displayLabel: `${nextNum}경기장`, venueName: "", address: "", phone: "" },
                  ]);
                }}
                className={chrome.addVenueBtn}
              >
                대회장소 추가
              </button>
            </div>
          </div>
          {defaultVenueInfo?.organizerName ? (
            <p className={`mb-2 ${chrome.muted}`}>기본정보 기준: {defaultVenueInfo.organizerName}</p>
          ) : null}
          <div className="space-y-3">
            {venues.map((v, idx) => (
              <div key={v.venueNumber} className={chrome.venueCard}>
                <div className={chrome.venueTitle}>{v.displayLabel}</div>
                <input
                  type="text"
                  className={chrome.venueInput}
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
                  className={chrome.venueInput}
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
                  className={chrome.venueInput}
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
      <section className={chrome.section}>
        <h2 className={chrome.sectionTitle}>경기요강 (선택)</h2>
        {children}
      </section>

      <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-3 pt-2 sm:items-center">
        <Link
          href={onCancelHref}
          className={chrome.linkBtn}
        >
          취소
        </Link>
        {showDraftSaveButton ? (
          <button
            type="button"
            disabled={saving}
            className={chrome.linkBtn}
            onClick={() => {
              submitAsDraftRef.current = true;
              const formEl = document.getElementById(
                tournamentId ? `tournament-form-${tournamentId}` : "tournament-form-new"
              ) as HTMLFormElement | null;
              formEl?.requestSubmit();
            }}
          >
            {saving ? "처리 중..." : "임시저장"}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className={chrome.submitBtn}
        >
          {saving ? "저장 중..." : submitLabel ?? (mode === "create" ? "등록" : "저장")}
        </button>
        {saving ? (
          <span className="text-sm text-gray-600 dark:text-slate-400" role="status">저장 중...</span>
        ) : success ? (
          <span className="text-sm text-green-700 dark:text-green-300" role="status">저장 완료</span>
        ) : null}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
