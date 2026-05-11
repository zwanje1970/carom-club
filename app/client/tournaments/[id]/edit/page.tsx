"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type CSSProperties, FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

import adminUi from "../../../../components/admin/admin-card.module.css";
import { isEmptyOutlineHtml } from "../../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../../lib/outline-content-types";
import type { Tournament } from "../../../../../lib/types/entities";
import type {
  TournamentDivisionMetricType,
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../../../../../lib/tournament-rule-types";
import TournamentNewWizardForm from "../../new/TournamentNewWizardForm";

type DivisionRow = { name: string; min: string; max: string };
const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function toDateInputValue(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function withWeekdayLabel(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return s;
  return `${s} (${KO_WEEKDAYS[d.getDay()]})`;
}

function parseLocationToLines(loc: string): [string, string, string] {
  const t = loc.trim();
  if (!t) return ["", "", ""];
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  if (lines.length >= 3) {
    return [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  }
  if (lines.length === 2) {
    return [lines[0] ?? "", lines[1] ?? "", ""];
  }
  const one = lines[0] ?? "";
  const parts = one.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return [parts[0]!, parts[1]!, parts[2]!];
  }
  return [one, "", ""];
}

function buildLocationFromLines(a: string, b: string, c: string): string {
  return [a, b, c].map((x) => x.trim()).filter((x) => x.length > 0).join("\n");
}

function parsePrizeInfoToFields(prizeInfo: string | null): {
  prize1: string;
  prize2: string;
  prize3: string;
  prize4: string;
  prizeThirdShared: boolean;
  prizeExtra: string;
} {
  const out = { prize1: "", prize2: "", prize3: "", prize4: "", prizeThirdShared: true, prizeExtra: "" };
  if (!prizeInfo?.trim()) return out;
  const lines = prizeInfo.split("\n").map((l) => l.trim()).filter(Boolean);
  const extra: string[] = [];
  for (const line of lines) {
    if (line.startsWith("우승:")) {
      out.prize1 = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("준우승:")) {
      out.prize2 = line.slice(4).trim();
      continue;
    }
    if (/^공동\s*3(?:위|등)\s*:/.test(line)) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (value) out.prize3 = value;
      out.prizeThirdShared = true;
      continue;
    }
    if (/^3(?:위|등)\s*:/.test(line)) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (!out.prize3) {
        out.prize3 = value;
      } else if (value && value !== out.prize3) {
        extra.push(line);
      }
      continue;
    }
    if (/^4(?:위|등)\s*:/.test(line)) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (value) {
        out.prize4 = value;
        out.prizeThirdShared = false;
      }
      continue;
    }
    extra.push(line);
  }
  out.prizeExtra = extra.join("\n");
  return out;
}

/** 상금 액수 입력란: 숫자만 (만원 단위 정수) */
function prizeAmountDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 클라이언트 안내용: 파일명 확장자만 (MIME 검사 없음) */
function hasTournamentPosterImageExtension(fileName: string): boolean {
  const n = fileName.trim().toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp");
}

const POSTER_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** 클라이언트 전용: `<img src>`에 레거시 `/api/site-images`·`/api/proof-images`가 오면 `/site-images/...`로만 바꿈 */
function normalizePosterImageSrcForPreview(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("/api/site-images/")) {
    const hashless = trimmed.split("#")[0] ?? trimmed;
    const q = hashless.indexOf("?");
    const pathPart = q >= 0 ? hashless.slice(0, q) : hashless;
    const idRaw = pathPart.replace(/^\/api\/site-images\//, "").trim();
    if (idRaw) {
      const id = decodeURIComponent(idRaw);
      const sp = new URLSearchParams(q >= 0 ? hashless.slice(q + 1) : "");
      const vr = sp.get("variant");
      const v = vr === "original" || vr === "w320" || vr === "w640" ? vr : "w640";
      return `/site-images/${v}/${encodeURIComponent(id)}`;
    }
  }

  if (trimmed.startsWith("/api/proof-images/")) {
    const idMatch = trimmed.match(/^\/api\/proof-images\/([^/?#]+)/);
    const vMatch = trimmed.match(/[?&]variant=(original|w320|w640)/);
    const id = idMatch?.[1] ? decodeURIComponent(idMatch[1]) : "";
    const v = (vMatch?.[1] as "original" | "w320" | "w640" | undefined) ?? "w640";
    if (id) return `/site-images/${v}/${encodeURIComponent(id)}`;
  }

  return trimmed;
}

const inputStyle: CSSProperties = {
  padding: "0.55rem",
  border: "1px solid #bbb",
  borderRadius: "0.4rem",
};

const sectionGap: CSSProperties = { gap: "1.05rem" };

export default function ClientTournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const editId =
    typeof params?.id === "string" && params.id.trim() !== "" ? params.id.trim() : null;
  const [editLoading, setEditLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [locLine1, setLocLine1] = useState("");
  const [locLine2, setLocLine2] = useState("");
  const [locLine3, setLocLine3] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("64");
  const [entryFee, setEntryFee] = useState("30000");
  const [durationType, setDurationType] = useState<TournamentDurationType>("1_DAY");
  const [durationDays, setDurationDays] = useState(2);
  /** `MULTI_DAY`일 때 2일차~ (길이 = durationDays - 1) */
  const [extraDays, setExtraDays] = useState<string[]>([]);

  const [entryQualificationType, setEntryQualificationType] =
    useState<TournamentEntryQualificationType>("NONE");
  const [qualificationValue, setQualificationValue] = useState("");
  const [eligibilityCompare, setEligibilityCompare] = useState<TournamentTeamScoreRule>("LTE");

  const [verificationRequested, setVerificationRequested] = useState(false);
  const [verificationMode, setVerificationMode] = useState<TournamentVerificationMode>("NONE");
  const [verificationGuideText, setVerificationGuideText] = useState("");

  const [divisionEnabled, setDivisionEnabled] = useState(false);
  const [divisionMetricType, setDivisionMetricType] = useState<TournamentDivisionMetricType>("AVERAGE");
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>([{ name: "", min: "", max: "" }]);

  const [scope, setScope] = useState<TournamentScope>("REGIONAL");
  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [allowMultipleSlots, setAllowMultipleSlots] = useState(false);
  const [participantsListPublic, setParticipantsListPublic] = useState(false);

  const [isScotch, setIsScotch] = useState(false);
  const [teamScoreLimit, setTeamScoreLimit] = useState("");
  const [teamScoreRule, setTeamScoreRule] = useState<TournamentTeamScoreRule>("LTE");

  const [posterImageUrl, setPosterImageUrl] = useState("");
  /** 업로드 완료 전 임시 미리보기 (서버 URL과 분리) */
  const [posterObjectPreviewUrl, setPosterObjectPreviewUrl] = useState("");
  /** true면 미리보기 `<img>`에 서버 URL 사용(숨김 프리로드 onLoad 이후에만 true) */
  const [posterVisibleUsesServerUrl, setPosterVisibleUsesServerUrl] = useState(true);
  const [posterUploading, setPosterUploading] = useState(false);
  /** 차단용이 아닌 안내(용량·확장자 등). 업로드는 별도로 항상 시도 */
  const [posterNotice, setPosterNotice] = useState("");
  const posterInputRef = useRef<HTMLInputElement>(null);

  const [tournamentIntro, setTournamentIntro] = useState("");
  const [prize1, setPrize1] = useState("");
  const [prize2, setPrize2] = useState("");
  const [prize3, setPrize3] = useState("");
  const [prize4, setPrize4] = useState("");
  const [prizeThirdShared, setPrizeThirdShared] = useState(true);
  const [prizeExtra, setPrizeExtra] = useState("");

  const [outlineDisplayMode, setOutlineDisplayMode] = useState<OutlineDisplayMode>("TEXT");
  const [outlineHtml, setOutlineHtml] = useState("");
  const [outlineImageUrl, setOutlineImageUrl] = useState("");
  const [outlinePdfUrl, setOutlinePdfUrl] = useState("");
  const [outlineEditorCompact, setOutlineEditorCompact] = useState(false);

  const [extraVenues, setExtraVenues] = useState<{ address: string; name: string; phone: string }[]>([]);

  /** 세션의 소속 당구장 ID(없으면 CTA 비연결만 가능) */
  const [creatorVenueId, setCreatorVenueId] = useState<string | null>(null);
  /** 내 당구장 연결 vs 없음 */
  const [venueCtaMode, setVenueCtaMode] = useState<"creator" | "none">("none");
  /** 장소 검색으로 선택한 당구장 ID(시합장 보기), 수동 입력 시 해제 */
  const [pickedVenueGuideId, setPickedVenueGuideId] = useState<string | null>(null);
  const [venueSearchResults, setVenueSearchResults] = useState<
    { venueId: string; name: string; addressLine: string; phone: string | null }[]
  >([]);
  const [venueSearchOpen, setVenueSearchOpen] = useState(false);
  const venueSearchWrapRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  /** 대회 생성·수정 입력 단계(1~8). 저장 로직과 무관한 UI 상태 */
  const [wizardStep, setWizardStep] = useState(1);
  /** 신규 생성 시 증빙 정책(확인 함/안 함)을 한 번이라도 눌렀는지 — 제출 전 필수 */
  const [step8PolicyAcknowledged, setStep8PolicyAcknowledged] = useState(false);
  /** 수정 모드: 불러온 직후 폼 스냅샷(JSON) — 변경 여부 비교용 */
  const editBaselineJsonRef = useRef<string | null>(null);
  /** 이탈 확인 후 이동할 내부 경로(모바일 ← 등). 없으면 router.back() */
  const pendingLeaveHrefRef = useRef<string | null>(null);
  const hasUnsavedDraftRef = useRef(false);
  /** 뒤로가기(popstate)로 연 확인창인지 — 나가기 시 history 한 번에 두 단계 복귀 */
  const leaveViaHistoryBackRef = useRef(false);
  /** 저장 전 이탈 방지용 히스토리 중복 항목이 활성인지 */
  const trapActiveRef = useRef(false);
  /** 프로그램적 history 조작 시 popstate 무시(남은 횟수) */
  const ignorePopstateCountRef = useRef(0);

  function historyStateHasEditTrap(): boolean {
    const s = window.history.state as { ccEditTrap?: unknown } | null;
    return s != null && typeof s === "object" && s.ccEditTrap === 1;
  }

  function pushEditHistoryTrap() {
    const prev = window.history.state;
    const next =
      prev != null && typeof prev === "object" && !Array.isArray(prev)
        ? { ...prev, ccEditTrap: 1 as const }
        : { ccEditTrap: 1 as const };
    window.history.pushState(next, "", window.location.href);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 40rem)");
    const apply = () => setOutlineEditorCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (editId) return;
    let cancelled = false;
    void fetch("/api/client/organization")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (org: {
          name?: string;
          address?: string | null;
          addressDetail?: string | null;
          phone?: string | null;
        } | null) => {
          if (cancelled || !org) return;
          const n = org.name?.trim() ?? "";
          const addr = [org.address?.trim(), org.addressDetail?.trim()].filter(Boolean).join(" ");
          const ph = org.phone?.trim() ?? "";
          setLocLine1((prev) => (prev.trim() === "" ? n : prev));
          setLocLine2((prev) => (prev.trim() === "" ? addr : prev));
          setLocLine3((prev) => (prev.trim() === "" ? ph : prev));
        }
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    if (durationType !== "MULTI_DAY") return;
    const need = Math.max(0, durationDays - 1);
    setExtraDays((prev) => Array.from({ length: need }, (_, i) => (i < prev.length ? prev[i]! : "")));
  }, [durationType, durationDays]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { authenticated?: boolean; user?: { linkedVenueId?: string | null } }) => {
        if (cancelled) return;
        const raw = data.user?.linkedVenueId;
        const id = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
        setCreatorVenueId(id);
        if (id && !editId) setVenueCtaMode("creator");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    const q = locLine1.trim();
    if (q.length < 1) {
      setVenueSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/client/venues-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: {
            venues?: { venueId: string; name: string; addressLine: string; phone: string | null }[];
          } | null) => {
            setVenueSearchResults(Array.isArray(data?.venues) ? data!.venues : []);
          }
        )
        .catch(() => setVenueSearchResults([]));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [locLine1]);

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      const el = venueSearchWrapRef.current;
      if (!el || el.contains(ev.target as Node)) return;
      setVenueSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setEditLoading(true);
    setMessage("");
    void fetch(`/api/client/tournaments/${encodeURIComponent(editId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("load");
        return r.json() as Promise<{ tournament?: Tournament }>;
      })
      .then((data) => {
        if (cancelled || !data.tournament) return;
        const t = data.tournament;
        const r = t.rule;
        setTitle(t.title);
        setDate(
          t.eventDates && t.eventDates.length > 0
            ? toDateInputValue(t.eventDates[0]!)
            : toDateInputValue(t.date)
        );
        {
          const [l1, l2, l3] = parseLocationToLines(t.location ?? "");
          setLocLine1(l1);
          setLocLine2(l2);
          setLocLine3(l3);
        }
        setPickedVenueGuideId(t.venueGuideVenueId ?? null);
        setMaxParticipants(String(t.maxParticipants));
        setEntryFee(String(t.entryFee));
        const dur: TournamentDurationType = r.durationType === "MULTI_DAY" ? "MULTI_DAY" : "1_DAY";
        setDurationType(dur);
        const dd =
          r.durationDays != null && r.durationDays >= 2 && r.durationDays <= 10 ? r.durationDays : 2;
        setDurationDays(dd);
        if (dur === "MULTI_DAY" && t.eventDates && t.eventDates.length > 1) {
          setExtraDays(t.eventDates.slice(1).map((d) => toDateInputValue(d)));
        } else if (dur === "MULTI_DAY") {
          setExtraDays(Array.from({ length: Math.max(0, dd - 1) }, () => ""));
        } else {
          setExtraDays([]);
        }
        setEntryQualificationType(
          r.entryQualificationType === "BOTH" ? "EVER" : r.entryQualificationType
        );
        setQualificationValue(
          r.eligibilityValue != null && Number.isFinite(r.eligibilityValue) ? String(r.eligibilityValue) : ""
        );
        setEligibilityCompare(r.eligibilityCompare === "LT" ? "LT" : "LTE");
        setVerificationRequested(r.verificationMode !== "NONE");
        setVerificationMode(r.verificationMode);
        setVerificationGuideText(r.verificationGuideText ?? "");
        setStep8PolicyAcknowledged(true);
        setDivisionEnabled(false);
        setDivisionMetricType(r.divisionMetricType);
        if (r.divisionRulesJson?.length) {
          setDivisionRows(
            r.divisionRulesJson.map((row) => ({
              name: row.name,
              min: row.min != null ? String(row.min) : "",
              max: row.max != null ? String(row.max) : "",
            }))
          );
        } else {
          setDivisionRows([{ name: "", min: "", max: "" }]);
        }
        setScope(r.scope);
        setZonesEnabled(t.zonesEnabled === true);
        setAccountNumber(r.accountNumber ?? "");
        setAllowMultipleSlots(r.allowMultipleSlots);
        setParticipantsListPublic(r.participantsListPublic);
        setExtraVenues(
          t.extraVenues?.length
            ? t.extraVenues.map((v) => ({
                address: v.address ?? "",
                name: v.name ?? "",
                phone: v.phone ?? "",
              }))
            : []
        );
        setIsScotch(r.isScotch);
        setTeamScoreLimit(r.teamScoreLimit != null ? String(r.teamScoreLimit) : "");
        setTeamScoreRule(r.teamScoreRule);
        {
          const raw = t.posterImageUrl?.trim() ?? "";
          setPosterImageUrl(raw ? normalizePosterImageSrcForPreview(raw) : "");
        }
        setPosterObjectPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return "";
        });
        setPosterVisibleUsesServerUrl(true);
        setPosterNotice("");
        setTournamentIntro(t.summary ?? "");
        const prizes = parsePrizeInfoToFields(t.prizeInfo);
        setPrize1(prizeAmountDigitsOnly(prizes.prize1));
        setPrize2(prizeAmountDigitsOnly(prizes.prize2));
        setPrize3(prizeAmountDigitsOnly(prizes.prize3));
        setPrize4(prizeAmountDigitsOnly(prizes.prize4));
        setPrizeThirdShared(prizes.prizeThirdShared);
        setPrizeExtra(prizes.prizeExtra);
        setOutlineDisplayMode(t.outlineDisplayMode ?? "TEXT");
        setOutlineHtml(t.outlineHtml ?? "");
        setOutlineImageUrl(t.outlineImageUrl ?? "");
        setOutlinePdfUrl(t.outlinePdfUrl ?? "");
        void fetch("/api/auth/session")
          .then((r) => r.json())
          .then((data: { user?: { linkedVenueId?: string | null } }) => {
            const linked =
              typeof data.user?.linkedVenueId === "string" && data.user.linkedVenueId.trim() !== ""
                ? data.user.linkedVenueId.trim()
                : null;
            const vg = t.venueGuideVenueId?.trim() ?? "";
            if (vg && linked && vg === linked) setVenueCtaMode("creator");
            else setVenueCtaMode("none");
          })
          .catch(() => setVenueCtaMode("none"));
      })
      .catch(() => {
        if (!cancelled) setMessage("대회 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    editBaselineJsonRef.current = null;
  }, [editId]);

  useEffect(() => {
    setWizardStep(1);
    setStep8PolicyAcknowledged(false);
  }, [editId]);

  function serializeTournamentFormSnapshot(): string {
    return JSON.stringify({
      title,
      date,
      locLine1,
      locLine2,
      locLine3,
      pickedVenueGuideId,
      maxParticipants,
      entryFee,
      durationType,
      durationDays,
      extraDays,
      entryQualificationType,
      qualificationValue,
      eligibilityCompare,
      verificationRequested,
      verificationMode,
      verificationGuideText,
      divisionEnabled,
      divisionMetricType,
      divisionRows,
      scope,
      zonesEnabled,
      accountNumber,
      allowMultipleSlots,
      participantsListPublic,
      isScotch,
      teamScoreLimit,
      teamScoreRule,
      posterImageUrl,
      posterObjectPreviewUrl: posterObjectPreviewUrl ? "1" : "",
      tournamentIntro,
      prize1,
      prize2,
      prize3,
      prize4,
      prizeThirdShared,
      prizeExtra,
      outlineDisplayMode,
      outlineHtml,
      outlineImageUrl,
      outlinePdfUrl,
      venueCtaMode,
      extraVenues,
    });
  }

  useEffect(() => {
    if (!editId || editLoading) return;
    const t = window.setTimeout(() => {
      editBaselineJsonRef.current = serializeTournamentFormSnapshot();
    }, 0);
    return () => window.clearTimeout(t);
    // 의도: 수정 데이터 로드 직후 한 번만 기준선 저장 (필드 전체는 serialize에서 반영)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, editLoading]);

  useEffect(() => {
    return () => {
      if (posterObjectPreviewUrl) URL.revokeObjectURL(posterObjectPreviewUrl);
    };
  }, [posterObjectPreviewUrl]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!posterObjectPreviewUrl && !posterImageUrl) return;
    const normalized =
      posterImageUrl.trim() !== "" ? normalizePosterImageSrcForPreview(posterImageUrl) : "";
    const src =
      posterObjectPreviewUrl && !posterVisibleUsesServerUrl
        ? posterObjectPreviewUrl
        : normalized || posterObjectPreviewUrl || "";
    // eslint-disable-next-line no-console -- 화면에 쓰는 최종 미리보기 src 점검용
    console.log("[poster preview] display src", src, {
      blob: Boolean(posterObjectPreviewUrl),
      server: posterImageUrl || null,
      visibleUsesServer: posterVisibleUsesServerUrl,
    });
  }, [posterObjectPreviewUrl, posterImageUrl, posterVisibleUsesServerUrl]);

  function hasUnsavedDraft(): boolean {
    if (!editId) return false;
    if (editLoading || editBaselineJsonRef.current === null) return false;
    return serializeTournamentFormSnapshot() !== editBaselineJsonRef.current;
  }

  function handleCancelClick() {
    pendingLeaveHrefRef.current = null;
    if (!hasUnsavedDraft()) {
      router.back();
      return;
    }
    setLeaveConfirmOpen(true);
  }

  function handleDismissLeaveModal() {
    setLeaveConfirmOpen(false);
    pendingLeaveHrefRef.current = null;
    leaveViaHistoryBackRef.current = false;
  }

  function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    const href = pendingLeaveHrefRef.current;
    pendingLeaveHrefRef.current = null;
    const viaHistoryBack = leaveViaHistoryBackRef.current;
    leaveViaHistoryBackRef.current = false;

    if (href) {
      router.push(href);
      return;
    }

    if (trapActiveRef.current || viaHistoryBack) {
      trapActiveRef.current = false;
      ignorePopstateCountRef.current = 2;
      window.history.go(-2);
      return;
    }

    router.back();
  }

  function buildPrizeInfo(): string | null {
    const parts: string[] = [];
    if (prize1.trim()) parts.push(`우승: ${prize1.trim()}`);
    if (prize2.trim()) parts.push(`준우승: ${prize2.trim()}`);
    if (prize3.trim()) {
      parts.push(`${prizeThirdShared ? "공동 3위" : "3위"}: ${prize3.trim()}`);
    }
    if (!prizeThirdShared && prize4.trim()) parts.push(`4위: ${prize4.trim()}`);
    if (prizeExtra.trim()) parts.push(prizeExtra.trim());
    return parts.length ? parts.join("\n") : null;
  }

  type WizardValidateFail = { ok: false; step: number; message: string; focusId: string };
  type WizardValidateOk = { ok: true };

  function validateWizardBeforeSave(): WizardValidateOk | WizardValidateFail {
    if (!title.trim()) {
      return { ok: false, step: 1, message: "대회명을 입력해 주세요.", focusId: "wiz-title" };
    }
    const maxN = Number(maxParticipants);
    if (!Number.isFinite(maxN) || maxN < 1) {
      return { ok: false, step: 2, message: "모집 인원을 올바르게 입력해 주세요.", focusId: "wiz-max" };
    }
    if (entryQualificationType !== "NONE") {
      const qParsed = Number.parseFloat(qualificationValue.replace(",", "."));
      if (!Number.isFinite(qParsed)) {
        return { ok: false, step: 3, message: "참가 자격에 맞는 점수 또는 에버를 입력해 주세요.", focusId: "wiz-qual" };
      }
    }
    if (!date.trim()) {
      return { ok: false, step: 4, message: "대회 날짜를 선택해 주세요.", focusId: "wiz-date" };
    }
    if (durationType === "MULTI_DAY") {
      const first = date.trim();
      const all = [first, ...extraDays.map((d) => d.trim())];
      if (all.length !== durationDays || all.some((d) => !d)) {
        const missingExtraIdx = all.slice(1).findIndex((d) => !d);
        return {
          ok: false,
          step: 4,
          message: `대회 일정을 ${durationDays}일 모두 선택해 주세요.`,
          focusId: missingExtraIdx >= 0 ? "wiz-extra-day-0" : "wiz-date",
        };
      }
    }
    if (!locLine1.trim()) {
      return { ok: false, step: 4, message: "장소 상호를 입력해 주세요.", focusId: "wiz-loc1" };
    }
    const prize = buildPrizeInfo();
    if (!prize?.trim()) {
      return { ok: false, step: 6, message: "상금 정보를 입력해 주세요.", focusId: "wiz-prize1" };
    }
    const fee = Number(entryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      return { ok: false, step: 7, message: "참가비를 올바르게 입력해 주세요.", focusId: "wiz-fee" };
    }
    if (!accountNumber.trim()) {
      return { ok: false, step: 7, message: "입금 계좌 안내를 입력해 주세요.", focusId: "wiz-account" };
    }
    if (!step8PolicyAcknowledged) {
      return { ok: false, step: 8, message: "증빙 확인 정책을 선택해 주세요.", focusId: "wiz-verify-policy" };
    }
    if (verificationRequested && verificationMode !== "MANUAL" && verificationMode !== "AUTO") {
      return { ok: false, step: 8, message: "증빙 확인 방식을 선택해 주세요.", focusId: "wiz-verify-mode" };
    }
    return { ok: true };
  }

  async function handlePosterFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setPosterNotice("");
    setPosterImageUrl("");
    setPosterVisibleUsesServerUrl(false);
    setPosterObjectPreviewUrl(() => {
      try {
        return URL.createObjectURL(file);
      } catch {
        return "";
      }
    });

    const hints: string[] = [];
    if (!hasTournamentPosterImageExtension(file.name)) {
      hints.push("jpg·jpeg·png·webp 파일을 권장합니다.");
    }
    if (file.size > POSTER_IMAGE_MAX_BYTES) {
      hints.push("파일이 큽니다. 업로드에 시간이 걸릴 수 있습니다.");
    }
    setPosterNotice(hints.join(" "));

    setPosterUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("sitePublic", "1");

    let res: Response | undefined;
    try {
      res = await fetch("/api/upload/image", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
    } catch {
      // 네트워크 오류: 미리보기·폼은 유지, 재시도 가능
    }

    if (posterInputRef.current) posterInputRef.current.value = "";
    setPosterUploading(false);

    if (!res) return;

    let data: { error?: string; w640Url?: string; w320Url?: string } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      // JSON 실패: 조용히 종료, 로컬 미리보기 유지
    }

    const w640 = typeof data.w640Url === "string" ? data.w640Url.trim() : "";
    const w320 = typeof data.w320Url === "string" ? data.w320Url.trim() : "";
    const nextUrl = w640 || w320;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- 포스터 미리보기 URL 점검용
      console.log("[poster upload] urls", { w640, w320, chosen: nextUrl });
    }

    if (res.ok && nextUrl) {
      setPosterImageUrl(normalizePosterImageSrcForPreview(nextUrl));
      setPosterVisibleUsesServerUrl(false);
      setPosterNotice("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !editId) return;

    const wizardCheck = validateWizardBeforeSave();
    if (!wizardCheck.ok) {
      setWizardStep(wizardCheck.step);
      setMessage(wizardCheck.message);
      setSaveState("idle");
      window.setTimeout(() => {
        const el = document.getElementById(wizardCheck.focusId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement | null)?.focus?.();
      }, 0);
      return;
    }

    setLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      const outlineHtmlPayload =
        outlineHtml.trim() !== "" && !isEmptyOutlineHtml(outlineHtml) ? outlineHtml : null;
      const outlineImagePayload = outlineImageUrl.trim() !== "" ? outlineImageUrl.trim() : null;
      const outlinePdfPayload = outlinePdfUrl.trim() !== "" ? outlinePdfUrl.trim() : null;
      const hasAnyOutline = Boolean(outlineHtmlPayload || outlineImagePayload || outlinePdfPayload);

      const qParsed =
        entryQualificationType !== "NONE" && qualificationValue.trim() !== ""
          ? Number.parseFloat(qualificationValue.replace(",", "."))
          : NaN;
      const eligibilityNum = Number.isFinite(qParsed) ? qParsed : null;

      let eventDatesPayload: string[] | undefined;
      if (durationType === "MULTI_DAY") {
        const first = date.trim();
        eventDatesPayload = [first, ...extraDays.map((d) => d.trim())];
      } else {
        eventDatesPayload = date.trim() ? [date.trim()] : undefined;
      }

      const vm: TournamentVerificationMode = verificationRequested ? verificationMode : "NONE";
      const extraPayload =
        extraVenues.length > 0
          ? extraVenues.map((v) => ({
              address: v.address.trim(),
              name: v.name.trim(),
              phone: v.phone.trim(),
            }))
          : null;

      const locationStr = buildLocationFromLines(locLine1, locLine2, locLine3);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        date: date.trim(),
        location: locationStr,
        maxParticipants: Number(maxParticipants),
        entryFee: Number(entryFee),
        posterImageUrl: posterImageUrl.trim() || null,
        summary: tournamentIntro.trim() || null,
        prizeInfo: buildPrizeInfo(),
        outlineDisplayMode: hasAnyOutline ? outlineDisplayMode : null,
        outlineHtml: outlineHtmlPayload,
        outlineImageUrl: outlineImagePayload,
        outlinePdfUrl: outlinePdfPayload,
        venueGuideVenueId:
          pickedVenueGuideId ??
          (venueCtaMode === "creator" && creatorVenueId ? creatorVenueId : null),
        eventDates: eventDatesPayload,
        extraVenues: extraPayload,
        durationType,
        durationDays: durationType === "MULTI_DAY" ? durationDays : null,
        entryQualificationType,
        entryCondition: null,
        verificationMode: vm === "NONE" ? "NONE" : vm,
        verificationReviewRequired: true,
        verificationGuideText: vm === "NONE" ? null : verificationGuideText.trim() || null,
        eligibilityCompare,
        eligibilityValue: eligibilityNum,
        divisionEnabled: false,
        divisionMetricType,
        divisionRulesJson: null,
        scope,
        region: null,
        zonesEnabled,
        accountNumber: accountNumber.trim() || null,
        allowMultipleSlots,
        participantsListPublic,
        isScotch,
        teamScoreLimit: isScotch && teamScoreLimit.trim() !== "" ? Number(teamScoreLimit) : null,
        teamScoreRule: isScotch ? teamScoreRule : "LTE",
      };

      const response = await fetch(`/api/client/tournaments/${encodeURIComponent(editId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; tournament?: { id: string } };
      if (!response.ok) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        setSaveState("error");
        return;
      }

      const savedId = result.tournament?.id;
      if (!savedId) {
        setMessage("저장 결과를 확인할 수 없습니다.");
        setSaveState("error");
        return;
      }

      setSaveState("success");
      setMessage("저장되었습니다.");
      editBaselineJsonRef.current = serializeTournamentFormSnapshot();
    } catch {
      setMessage("저장 요청 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setLoading(false);
    }
  }

  hasUnsavedDraftRef.current = hasUnsavedDraft();

  /* 저장 전에만 히스토리 트랩 삽입·해제 — 매 렌더마다 더티 여부와 동기화 */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 폼 변경마다 더티·히스토리 일치
  useLayoutEffect(() => {
    if (!editId || editLoading || editBaselineJsonRef.current === null) return;

    const dirty = hasUnsavedDraftRef.current;

    if (dirty) {
      if (!trapActiveRef.current) {
        if (!historyStateHasEditTrap()) {
          pushEditHistoryTrap();
        }
        trapActiveRef.current = true;
      }
    } else if (trapActiveRef.current) {
      if (historyStateHasEditTrap()) {
        ignorePopstateCountRef.current = 1;
        window.history.back();
      }
      trapActiveRef.current = false;
    }
  });

  useEffect(() => {
    if (!editId) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedDraftRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editId]);

  useEffect(() => {
    if (typeof editId !== "string" || editId.trim() === "") return;
    const tournamentIdForEditPath = editId.trim();
    function onDocumentClickCapture(ev: MouseEvent) {
      if (!hasUnsavedDraftRef.current) return;
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const anchor = t.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank") return;
      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:")) return;
      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const cur = new URL(window.location.href);
      if (url.pathname === cur.pathname && url.search === cur.search) return;
      const editPath = `/client/tournaments/${encodeURIComponent(tournamentIdForEditPath)}/edit`;
      if (url.pathname === editPath) return;

      ev.preventDefault();
      ev.stopPropagation();
      pendingLeaveHrefRef.current = `${url.pathname}${url.search}${url.hash}`;
      setLeaveConfirmOpen(true);
    }
    document.addEventListener("click", onDocumentClickCapture, true);
    return () => document.removeEventListener("click", onDocumentClickCapture, true);
  }, [editId]);

  useEffect(() => {
    if (!editId) return;

    function onPopState() {
      if (ignorePopstateCountRef.current > 0) {
        ignorePopstateCountRef.current -= 1;
        return;
      }

      if (!hasUnsavedDraftRef.current) {
        trapActiveRef.current = false;
        return;
      }

      if (!historyStateHasEditTrap()) {
        pushEditHistoryTrap();
      }
      trapActiveRef.current = true;
      leaveViaHistoryBackRef.current = true;
      pendingLeaveHrefRef.current = null;
      setLeaveConfirmOpen(true);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [editId]);

  const posterNormalizedForDisplay =
    posterImageUrl.trim() !== "" ? normalizePosterImageSrcForPreview(posterImageUrl) : "";
  const posterImgSrc =
    posterObjectPreviewUrl && !posterVisibleUsesServerUrl
      ? posterObjectPreviewUrl
      : posterNormalizedForDisplay || posterObjectPreviewUrl || "";

  if (!editId) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto", paddingTop: "0.35rem" }}>
        <p className="v3-muted">대회 정보를 불러올 수 없습니다.</p>
      </main>
    );
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto", paddingTop: "0.35rem" }}>
      <h1 className="v3-h1">대회 수정</h1>
      <p className="v3-muted">
        아래에서 전체 항목을 한 화면에서 확인·수정할 수 있습니다. 상단 버튼은 해당 항목 위치로 스크롤 이동합니다. 저장하면 동일 대회에 반영됩니다.
      </p>

      {editLoading ? (
        <p className="v3-muted" role="status">
          대회 정보를 불러오는 중…
        </p>
      ) : null}

      <>
      <TournamentNewWizardForm
        inputStyle={inputStyle}
        sectionGap={sectionGap}
        wizardStep={wizardStep}
        setWizardStep={setWizardStep}
        editId={editId}
        editLoading={editLoading}
        loading={loading}
        saveState={saveState}
        onSubmit={handleSubmit}
        onCancelClick={handleCancelClick}
        title={title}
        setTitle={setTitle}
        tournamentIntro={tournamentIntro}
        setTournamentIntro={setTournamentIntro}
        maxParticipants={maxParticipants}
        setMaxParticipants={setMaxParticipants}
        isScotch={isScotch}
        setIsScotch={setIsScotch}
        scope={scope}
        setScope={setScope}
        zonesEnabled={zonesEnabled}
        setZonesEnabled={setZonesEnabled}
        allowMultipleSlots={allowMultipleSlots}
        setAllowMultipleSlots={setAllowMultipleSlots}
        participantsListPublic={participantsListPublic}
        setParticipantsListPublic={setParticipantsListPublic}
        entryQualificationType={entryQualificationType}
        setEntryQualificationType={setEntryQualificationType}
        qualificationValue={qualificationValue}
        setQualificationValue={setQualificationValue}
        eligibilityCompare={eligibilityCompare}
        setEligibilityCompare={setEligibilityCompare}
        date={date}
        setDate={setDate}
        durationType={durationType}
        setDurationType={setDurationType}
        durationDays={durationDays}
        setDurationDays={setDurationDays}
        extraDays={extraDays}
        setExtraDays={setExtraDays}
        withWeekdayLabel={withWeekdayLabel}
        locLine1={locLine1}
        setLocLine1={setLocLine1}
        locLine2={locLine2}
        setLocLine2={setLocLine2}
        locLine3={locLine3}
        setLocLine3={setLocLine3}
        venueSearchWrapRef={venueSearchWrapRef}
        venueSearchOpen={venueSearchOpen}
        setVenueSearchOpen={setVenueSearchOpen}
        venueSearchResults={venueSearchResults}
        setPickedVenueGuideId={setPickedVenueGuideId}
        extraVenues={extraVenues}
        setExtraVenues={setExtraVenues}
        posterInputRef={posterInputRef}
        posterObjectPreviewUrl={posterObjectPreviewUrl}
        posterImageUrl={posterImageUrl}
        posterVisibleUsesServerUrl={posterVisibleUsesServerUrl}
        posterUploading={posterUploading}
        posterNotice={posterNotice}
        posterImgSrc={posterImgSrc}
        posterNormalizedForDisplay={posterNormalizedForDisplay}
        onPosterFileChange={handlePosterFileChange}
        setPosterObjectPreviewUrl={setPosterObjectPreviewUrl}
        setPosterImageUrl={setPosterImageUrl}
        setPosterVisibleUsesServerUrl={setPosterVisibleUsesServerUrl}
        setPosterNotice={setPosterNotice}
        prize1={prize1}
        setPrize1={setPrize1}
        prize2={prize2}
        setPrize2={setPrize2}
        prize3={prize3}
        setPrize3={setPrize3}
        prize4={prize4}
        setPrize4={setPrize4}
        prizeThirdShared={prizeThirdShared}
        setPrizeThirdShared={setPrizeThirdShared}
        prizeExtra={prizeExtra}
        setPrizeExtra={setPrizeExtra}
        prizeAmountDigitsOnly={prizeAmountDigitsOnly}
        entryFee={entryFee}
        setEntryFee={setEntryFee}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        verificationRequested={verificationRequested}
        setVerificationRequested={setVerificationRequested}
        verificationMode={verificationMode}
        setVerificationMode={setVerificationMode}
        verificationGuideText={verificationGuideText}
        setVerificationGuideText={setVerificationGuideText}
        step8PolicyAcknowledged={step8PolicyAcknowledged}
        outlineDisplayMode={outlineDisplayMode}
        setOutlineDisplayMode={setOutlineDisplayMode}
        outlineHtml={outlineHtml}
        setOutlineHtml={setOutlineHtml}
        outlineImageUrl={outlineImageUrl}
        setOutlineImageUrl={setOutlineImageUrl}
        outlinePdfUrl={outlinePdfUrl}
        setOutlinePdfUrl={setOutlinePdfUrl}
        outlineEditorCompact={outlineEditorCompact}
        creatorVenueId={creatorVenueId}
        venueCtaMode={venueCtaMode}
        setVenueCtaMode={setVenueCtaMode}
        onStep8PolicyInteract={() => setStep8PolicyAcknowledged(true)}
        wizardNavigationMode="toc"
      />

      {saveState === "success" ? (
        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link className="v3-btn" href={`/client/tournaments/${encodeURIComponent(editId)}`} prefetch={false}>
            대회 화면으로 이동
          </Link>
        </div>
      ) : null}

      {message ? <p className="v3-muted">{message}</p> : null}

      {leaveConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-confirm-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div className={`${adminUi.surface} v3-stack`} style={{ maxWidth: "22rem", width: "100%", gap: "1rem" }}>
            <p id="leave-confirm-title" style={{ margin: 0, lineHeight: 1.5 }}>
              저장하지 않은 변경사항이 있습니다. 나가시겠습니까?
            </p>
            <div className="v3-row" style={{ gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" style={{ background: "#fff", border: "1px solid #bbb" }} onClick={handleDismissLeaveModal}>
                계속 수정
              </button>
              <button type="button" className="v3-btn" onClick={handleConfirmLeave}>
                나가기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      </>
    </main>
  );
}
