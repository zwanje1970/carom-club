"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import OutlineContentEditor from "../../../../components/shared/outline/OutlineContentEditor";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";
import { buildSiteVenueDetailPath, getSiteVenueById } from "../../../../lib/site-venues-catalog";
import type { Tournament } from "../../../../lib/server/dev-store";
import type {
  TournamentDivisionMetricType,
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../../../../lib/tournament-rule-types";

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
  prize3a: string;
  prize3b: string;
  prizeExtra: string;
} {
  const out = { prize1: "", prize2: "", prize3a: "", prize3b: "", prizeExtra: "" };
  if (!prizeInfo?.trim()) return out;
  const lines = prizeInfo.split("\n").map((l) => l.trim()).filter(Boolean);
  const extra: string[] = [];
  let thirdCount = 0;
  for (const line of lines) {
    if (line.startsWith("우승:")) {
      out.prize1 = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("준우승:")) {
      out.prize2 = line.slice(4).trim();
      continue;
    }
    if (line.startsWith("3위:")) {
      thirdCount += 1;
      if (thirdCount === 1) out.prize3a = line.slice(3).trim();
      else if (thirdCount === 2) out.prize3b = line.slice(3).trim();
      else extra.push(line);
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

const DEFAULT_VERIFICATION_GUIDE_TEXT = "에버리지 인증서, 또는 경기기록을 첨부하세요";

const EQ_OPTIONS: { value: TournamentEntryQualificationType; label: string }[] = [
  { value: "NONE", label: "관계없음" },
  { value: "EVER", label: "에버기준" },
  { value: "SCORE", label: "점수기준" },
];

const inputStyle: CSSProperties = {
  padding: "0.55rem",
  border: "1px solid #bbb",
  borderRadius: "0.4rem",
};

const sectionGap: CSSProperties = { gap: "1.25rem" };

export default function ClientTournamentNewPage() {
  const router = useRouter();

  const [editId, setEditId] = useState<string | null>(null);
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
  const [prize3a, setPrize3a] = useState("");
  const [prize3b, setPrize3b] = useState("");
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
  /** 새 대회 생성 직후 안내(저장은 이미 완료된 상태) */
  const [createSuccessId, setCreateSuccessId] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  /** 수정 모드: 불러온 직후 폼 스냅샷(JSON) — 변경 여부 비교용 */
  const editBaselineJsonRef = useRef<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get("edit");
    setEditId(e && e.trim() ? e.trim() : null);
  }, []);

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
        setPrize3a(prizeAmountDigitsOnly(prizes.prize3a));
        setPrize3b(prizeAmountDigitsOnly(prizes.prize3b));
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
      prize3a,
      prize3b,
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

  function isNewTournamentFormPristine(): boolean {
    if (title.trim() !== "") return false;
    if (date !== "") return false;
    if (buildLocationFromLines(locLine1, locLine2, locLine3).trim() !== "") return false;
    if (maxParticipants !== "64") return false;
    if (entryFee !== "30000") return false;
    if (durationType !== "1_DAY") return false;
    if (durationDays !== 2) return false;
    if (extraDays.length > 0) return false;
    if (entryQualificationType !== "NONE") return false;
    if (qualificationValue.trim() !== "") return false;
    if (eligibilityCompare !== "LTE") return false;
    if (verificationRequested) return false;
    if (verificationMode !== "NONE") return false;
    if (verificationGuideText.trim() !== "") return false;
    if (divisionMetricType !== "AVERAGE") return false;
    if (divisionRows.length !== 1) return false;
    const dr = divisionRows[0];
    if (!dr || dr.name.trim() !== "" || dr.min.trim() !== "" || dr.max.trim() !== "") return false;
    if (scope !== "REGIONAL") return false;
    if (accountNumber.trim() !== "") return false;
    if (allowMultipleSlots) return false;
    if (participantsListPublic) return false;
    if (isScotch) return false;
    if (teamScoreLimit.trim() !== "") return false;
    if (teamScoreRule !== "LTE") return false;
    if (posterImageUrl !== "" || posterObjectPreviewUrl !== "") return false;
    if (tournamentIntro.trim() !== "") return false;
    if (
      prize1.trim() !== "" ||
      prize2.trim() !== "" ||
      prize3a.trim() !== "" ||
      prize3b.trim() !== "" ||
      prizeExtra.trim() !== ""
    ) {
      return false;
    }
    if (outlineDisplayMode !== "TEXT") return false;
    if (!isEmptyOutlineHtml(outlineHtml)) return false;
    if (outlineImageUrl.trim() !== "") return false;
    if (outlinePdfUrl.trim() !== "") return false;
    if (pickedVenueGuideId !== null) return false;
    if (!creatorVenueId) {
      if (venueCtaMode !== "none") return false;
    } else if (venueCtaMode !== "creator") {
      return false;
    }
    if (extraVenues.length > 0) return false;
    return true;
  }

  function hasUnsavedDraft(): boolean {
    if (createSuccessId && !editId) return false;
    if (editId) {
      if (editLoading || editBaselineJsonRef.current === null) return false;
      return serializeTournamentFormSnapshot() !== editBaselineJsonRef.current;
    }
    return !isNewTournamentFormPristine();
  }

  function handleCancelClick() {
    if (!hasUnsavedDraft()) {
      router.back();
      return;
    }
    setLeaveConfirmOpen(true);
  }

  function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    router.back();
  }

  function buildPrizeInfo(): string | null {
    const parts: string[] = [];
    if (prize1.trim()) parts.push(`우승: ${prize1.trim()}`);
    if (prize2.trim()) parts.push(`준우승: ${prize2.trim()}`);
    if (prize3a.trim()) parts.push(`3위: ${prize3a.trim()}`);
    if (prize3b.trim()) parts.push(`3위: ${prize3b.trim()}`);
    if (prizeExtra.trim()) parts.push(prizeExtra.trim());
    return parts.length ? parts.join("\n") : null;
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

    let data: { error?: string; w640Url?: string; w320Url?: string; originalUrl?: string } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      // JSON 실패: 조용히 종료, 로컬 미리보기 유지
    }

    const w640 = typeof data.w640Url === "string" ? data.w640Url.trim() : "";
    const original = typeof data.originalUrl === "string" ? data.originalUrl.trim() : "";
    const w320 = typeof data.w320Url === "string" ? data.w320Url.trim() : "";
    const nextUrl = w640 || original || w320;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- 포스터 미리보기 URL 점검용
      console.log("[poster upload] urls", { w640, original, w320, chosen: nextUrl });
    }

    if (res.ok && nextUrl) {
      setPosterImageUrl(normalizePosterImageSrcForPreview(nextUrl));
      setPosterVisibleUsesServerUrl(false);
      setPosterNotice("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

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
        const all = [first, ...extraDays.map((d) => d.trim())];
        if (all.length !== durationDays || all.some((d) => !d)) {
          setMessage(`대회 일정을 ${durationDays}일 모두 선택해 주세요.`);
          setSaveState("error");
          setLoading(false);
          return;
        }
        eventDatesPayload = all;
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
        accountNumber: accountNumber.trim() || null,
        allowMultipleSlots,
        participantsListPublic,
        isScotch,
        teamScoreLimit: isScotch && teamScoreLimit.trim() !== "" ? Number(teamScoreLimit) : null,
        teamScoreRule: isScotch ? teamScoreRule : "LTE",
      };

      const url = editId
        ? `/api/client/tournaments/${encodeURIComponent(editId)}`
        : "/api/client/tournaments";
      const method = editId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; tournament?: { id: string } };
      if (!response.ok) {
        setMessage(result.error ?? (editId ? "저장에 실패했습니다." : "대회 생성에 실패했습니다."));
        setSaveState("error");
        return;
      }

      const savedId = result.tournament?.id;
      if (!savedId) {
        setMessage(editId ? "저장 결과를 확인할 수 없습니다." : "대회 생성 결과를 확인할 수 없습니다.");
        setSaveState("error");
        return;
      }

      if (editId) {
        setSaveState("success");
        router.push(`/client/tournaments/${savedId}`);
        router.refresh();
      } else {
        setSaveState("success");
        setCreateSuccessId(savedId);
        router.refresh();
      }
    } catch {
      setMessage(editId ? "저장 요청 중 오류가 발생했습니다." : "대회 생성 요청 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setLoading(false);
    }
  }

  const showCreateDone = Boolean(createSuccessId && !editId);

  const posterNormalizedForDisplay =
    posterImageUrl.trim() !== "" ? normalizePosterImageSrcForPreview(posterImageUrl) : "";
  const posterImgSrc =
    posterObjectPreviewUrl && !posterVisibleUsesServerUrl
      ? posterObjectPreviewUrl
      : posterNormalizedForDisplay || posterObjectPreviewUrl || "";

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto" }}>
      <h1 className="v3-h1">
        {showCreateDone ? "대회 생성 완료" : editId ? "대회 수정" : "새 대회 만들기"}
      </h1>
      <p className="v3-muted">
        {showCreateDone
          ? "대회 정보는 이미 저장되었습니다. 다음 단계는 선택입니다."
          : editId
            ? "기존 대회 정보를 불러왔습니다. 수정 후 저장하면 동일 대회에 반영됩니다."
            : "아래 순서대로 입력합니다. 대회 생성 시 포스터·안내말·상금이 함께 저장됩니다."}
      </p>

      {editId && editLoading ? (
        <p className="v3-muted" role="status">
          대회 정보를 불러오는 중…
        </p>
      ) : null}

      {showCreateDone && createSuccessId ? (
        <section className="v3-box v3-stack" style={{ gap: "0.85rem" }}>
          <p style={{ margin: 0 }}>
            <strong>대회가 생성되었습니다.</strong> 메인 화면에 노출할 <strong>대회 카드</strong>를 발행하려면 아래에서 이동할 수
            있습니다.
          </p>
          <p className="v3-muted" style={{ margin: 0, lineHeight: 1.5 }}>
            지금 바로 가지 않아도 됩니다. 대회는 목록·상세에 그대로 남아 있으며, 원할 때 대회 상세의 「게시카드 작성」에서도
            진행할 수 있습니다.
          </p>
          <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <Link className="v3-btn" href={`/client/tournaments/${createSuccessId}/card-publish`}>
              대회카드 발행 페이지로 이동
            </Link>
            <Link className="v3-btn" href={`/client/tournaments/${createSuccessId}`}>
              상세 보기
            </Link>
          </div>
        </section>
      ) : (
        <>
      <form className="v3-stack" style={sectionGap} onSubmit={handleSubmit}>
        {/* 1. 대회포스터 이미지 */}
        <section className="v3-box v3-stack" aria-label="대회 포스터" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            1. 대회 포스터 이미지
          </h2>
          <input
            ref={posterInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => void handlePosterFileChange(e.target.files)}
          />
          {posterObjectPreviewUrl || posterImageUrl ? (
            <div className="v3-stack" style={{ gap: "0.5rem", position: "relative" }}>
              {posterImageUrl && posterObjectPreviewUrl && !posterVisibleUsesServerUrl ? (
                <img
                  key={posterImageUrl}
                  src={posterNormalizedForDisplay || posterImageUrl}
                  alt=""
                  aria-hidden
                  decoding="async"
                  onLoad={() => {
                    setPosterVisibleUsesServerUrl(true);
                    setPosterObjectPreviewUrl("");
                  }}
                  onError={() => {
                    if (process.env.NODE_ENV === "development") {
                      // eslint-disable-next-line no-console -- 서버 이미지 로드 실패 점검
                      console.warn("[poster] server image preload failed (blob 유지)", posterImageUrl);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                />
              ) : null}
              <img
                src={posterImgSrc}
                alt="대회 포스터 미리보기"
                decoding="async"
                style={{ maxWidth: "100%", maxHeight: "14rem", objectFit: "contain", borderRadius: "0.35rem" }}
              />
              <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="v3-btn"
                  style={{ padding: "0.4rem 0.75rem" }}
                  onClick={() => posterInputRef.current?.click()}
                  disabled={posterUploading}
                >
                  {posterUploading ? "업로드 중…" : "이미지 바꾸기"}
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  style={{ padding: "0.4rem 0.75rem" }}
                  onClick={() => {
                    setPosterObjectPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return "";
                    });
                    setPosterImageUrl("");
                    setPosterVisibleUsesServerUrl(true);
                    setPosterNotice("");
                  }}
                  disabled={posterUploading}
                >
                  제거
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="v3-muted"
              onClick={() => posterInputRef.current?.click()}
              disabled={posterUploading}
              style={{
                border: "1px dashed #aaa",
                borderRadius: "0.4rem",
                padding: "1.25rem",
                textAlign: "center",
                fontSize: "0.9rem",
                width: "100%",
                cursor: posterUploading ? "wait" : "pointer",
                background: "transparent",
              }}
            >
              {posterUploading ? "업로드 중…" : "클릭하여 포스터 이미지 선택 (jpg / jpeg / png / webp, 선택 사항)"}
            </button>
          )}
          {posterNotice ? (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              {posterNotice}
            </p>
          ) : null}
        </section>

        {/* 2. 대회명 · 대회 설명 */}
        <section className="v3-box v3-stack" aria-label="대회명과 설명" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            2. 대회명 · 대회 설명
          </h2>
          <label className="v3-stack">
            <span>대회명</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 봄 정기전"
              style={inputStyle}
            />
          </label>
          <label className="v3-stack">
            <span>대회 설명</span>
            <textarea
              rows={3}
              value={tournamentIntro}
              onChange={(e) => setTournamentIntro(e.target.value)}
              placeholder="선택"
              style={inputStyle}
            />
          </label>
        </section>

        {/* 3. 대회 종류: 일반 / 스카치 */}
        <section className="v3-box v3-stack" aria-label="대회 종류" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            3. 대회 종류
          </h2>
          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
              <input
                type="radio"
                name="gameKind"
                checked={!isScotch}
                onChange={() => setIsScotch(false)}
              />
              <span>일반</span>
            </label>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
              <input
                type="radio"
                name="gameKind"
                checked={isScotch}
                onChange={() => setIsScotch(true)}
              />
              <span>스카치</span>
            </label>
          </div>
          {isScotch ? (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              스카치 시 합산 점수·에버는 「10. 참가 조건」에서 입력합니다.
            </p>
          ) : null}
        </section>

        {/* 4. 단일 / 전국 + 중복 참가 */}
        <section className="v3-box v3-stack" aria-label="대회 범위와 참가 운영" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            4. 대회 범위 · 중복 참가
          </h2>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="v3-stack" style={{ flex: "1 1 12rem" }}>
              <span>대회 범위</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as TournamentScope)}
                style={inputStyle}
              >
                <option value="REGIONAL">단일대회(당구장대회)</option>
                <option value="NATIONAL">권역대회(합동·전국대회)</option>
              </select>
            </label>
          </div>
          <div className="v3-row" style={{ gap: "1.25rem", flexWrap: "wrap" }}>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={allowMultipleSlots}
                onChange={(e) => setAllowMultipleSlots(e.target.checked)}
              />
              <span>중복 참가 허용</span>
            </label>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={participantsListPublic}
                onChange={(e) => setParticipantsListPublic(e.target.checked)}
              />
              <span>참가자 명단 공개</span>
            </label>
          </div>
        </section>

        {/* 5. 모집 인원 */}
        <section className="v3-box v3-stack" aria-label="모집 인원" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            5. 모집 인원
          </h2>
          <label className="v3-stack" style={{ maxWidth: "12rem" }}>
            <span>모집 인원</span>
            <input
              required
              type="number"
              min={1}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              style={inputStyle}
            />
          </label>
        </section>

        {/* 6. 참가비 + 입금 계좌 */}
        <section className="v3-box v3-stack" aria-label="참가비와 입금 계좌" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            6. 참가비 · 입금 계좌
          </h2>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap" }}>
            <label className="v3-stack" style={{ flex: "1 1 10rem" }}>
              <span>참가비(원)</span>
              <input
                required
                type="number"
                min={0}
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label className="v3-stack" style={{ flex: "2 1 14rem" }}>
              <span>입금 계좌 안내</span>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="은행 · 계좌 · 예금주"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* 7. 상금 (자리만) */}
        <section className="v3-box v3-stack" aria-label="상금" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            7. 상금
          </h2>
          <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            여러 줄로 합쳐 저장됩니다. (1등 / 2등 / 3등 / 3등 / 기타)
          </p>
          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
              <span>1등</span>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                <input
                  value={prize1}
                  onChange={(e) => setPrize1(prizeAmountDigitsOnly(e.target.value))}
                  placeholder="상금 (만원 단위, 숫자만 입력)"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 0", minWidth: 0 }}
                />
                <span className="v3-muted" style={{ flexShrink: 0, fontSize: "0.9rem" }}>
                  만원
                </span>
              </div>
            </label>
            <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
              <span>2등</span>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                <input
                  value={prize2}
                  onChange={(e) => setPrize2(prizeAmountDigitsOnly(e.target.value))}
                  placeholder="상금 (만원 단위, 숫자만 입력)"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 0", minWidth: 0 }}
                />
                <span className="v3-muted" style={{ flexShrink: 0, fontSize: "0.9rem" }}>
                  만원
                </span>
              </div>
            </label>
            <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
              <span>3등</span>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                <input
                  value={prize3a}
                  onChange={(e) => setPrize3a(prizeAmountDigitsOnly(e.target.value))}
                  placeholder="상금 (만원 단위, 숫자만 입력)"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 0", minWidth: 0 }}
                />
                <span className="v3-muted" style={{ flexShrink: 0, fontSize: "0.9rem" }}>
                  만원
                </span>
              </div>
            </label>
            <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
              <span>3등</span>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                <input
                  value={prize3b}
                  onChange={(e) => setPrize3b(prizeAmountDigitsOnly(e.target.value))}
                  placeholder="상금 (만원 단위, 숫자만 입력)"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 0", minWidth: 0 }}
                />
                <span className="v3-muted" style={{ flexShrink: 0, fontSize: "0.9rem" }}>
                  만원
                </span>
              </div>
            </label>
          </div>
          <label className="v3-stack">
            <span>기타</span>
            <textarea
              rows={2}
              value={prizeExtra}
              onChange={(e) => setPrizeExtra(e.target.value)}
              placeholder="4위 이하, 특별상 등"
              style={inputStyle}
            />
          </label>
        </section>

        {/* 8. 날짜 + 대회 기간 */}
        <section className="v3-box v3-stack" aria-label="날짜와 대회 기간" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            8. 날짜 · 대회 기간
          </h2>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="v3-stack" style={{ flex: "1 1 11rem" }}>
              <span>{durationType === "MULTI_DAY" ? "시작일 (1일차)" : "대회 날짜"}</span>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
              {date.trim() ? (
                <p className="v3-muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                  {withWeekdayLabel(date)}
                </p>
              ) : null}
            </label>
            <label className="v3-stack" style={{ flex: "1 1 11rem" }}>
              <span>대회 기간</span>
              <select
                value={durationType === "MULTI_DAY" ? `M:${durationDays}` : "1_DAY"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "1_DAY") {
                    setDurationType("1_DAY");
                  } else {
                    setDurationType("MULTI_DAY");
                    const n = Number(v.slice(2));
                    if (Number.isFinite(n) && n >= 2 && n <= 10) setDurationDays(n);
                  }
                }}
                style={inputStyle}
              >
                <option value="1_DAY">1일</option>
                {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={`M:${n}`}>
                    {n}일
                  </option>
                ))}
              </select>
            </label>
          </div>
          {durationType === "MULTI_DAY" && durationDays > 1 ? (
            <div className="v3-stack" style={{ gap: "0.5rem" }}>
              {Array.from({ length: durationDays - 1 }, (_, idx) => (
                <label key={idx} className="v3-stack" style={{ maxWidth: "14rem" }}>
                  <span>{idx + 2}일차</span>
                  <input
                    required
                    type="date"
                    value={extraDays[idx] ?? ""}
                    onChange={(e) => {
                      const next = [...extraDays];
                      next[idx] = e.target.value;
                      setExtraDays(next);
                    }}
                    style={inputStyle}
                  />
                  {(extraDays[idx] ?? "").trim() ? (
                    <p className="v3-muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                      {withWeekdayLabel(extraDays[idx] ?? "")}
                    </p>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null}
        </section>

        {/* 9. 대회 장소 */}
        <section className="v3-box v3-stack" aria-label="대회 장소" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            9. 대회 장소
          </h2>
          <p className="v3-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            상호를 입력하면 등록된 당구장을 검색할 수 있습니다. 목록에서 선택하면 상호·주소·전화가 줄 단위로 채워집니다. 직접 수정할 수 있습니다.
          </p>
          <div ref={venueSearchWrapRef} className="v3-stack" style={{ gap: "0.35rem", position: "relative" }}>
            <label className="v3-stack">
              <span>상호</span>
              <input
                required
                value={locLine1}
                onChange={(e) => {
                  setLocLine1(e.target.value);
                  setPickedVenueGuideId(null);
                  setVenueSearchOpen(true);
                }}
                onFocus={() => setVenueSearchOpen(true)}
                placeholder="등록 당구장 검색 또는 직접 입력"
                autoComplete="off"
                style={inputStyle}
              />
            </label>
            {venueSearchOpen && venueSearchResults.length > 0 ? (
              <ul
                role="listbox"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  margin: "0.2rem 0 0",
                  padding: "0.35rem 0",
                  listStyle: "none",
                  maxHeight: "12rem",
                  overflow: "auto",
                  background: "#fff",
                  border: "1px solid #bbb",
                  borderRadius: "0.4rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                {venueSearchResults.map((v) => (
                  <li key={v.venueId}>
                    <button
                      type="button"
                      role="option"
                      className="v3-btn"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.45rem 0.65rem",
                        background: "transparent",
                        border: "none",
                        borderRadius: 0,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocLine1(v.name);
                        setLocLine2(v.addressLine);
                        setLocLine3(v.phone ?? "");
                        setPickedVenueGuideId(v.venueId);
                        setVenueSearchOpen(false);
                      }}
                    >
                      {v.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="v3-stack">
            <span>주소 (상세주소 포함)</span>
            <input
              value={locLine2}
              onChange={(e) => {
                setLocLine2(e.target.value);
                setPickedVenueGuideId(null);
              }}
              placeholder="도로명 · 건물 동·층 등"
              style={inputStyle}
            />
          </label>
          <label className="v3-stack">
            <span>전화번호</span>
            <input
              value={locLine3}
              onChange={(e) => {
                setLocLine3(e.target.value);
                setPickedVenueGuideId(null);
              }}
              placeholder="전화번호"
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            className="v3-btn"
            style={{ alignSelf: "flex-start", padding: "0.4rem 0.75rem" }}
            onClick={() =>
              setExtraVenues((rows) => [...rows, { address: "", name: "", phone: "" }])
            }
          >
            대회장 추가
          </button>
          {extraVenues.map((row, idx) => (
            <div
              key={idx}
              className="v3-stack"
              style={{ gap: "0.4rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem" }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>추가 대회장 {idx + 1}</span>
              <label className="v3-stack">
                <span>주소</span>
                <input
                  value={row.address}
                  onChange={(e) => {
                    const next = [...extraVenues];
                    next[idx] = { ...next[idx]!, address: e.target.value };
                    setExtraVenues(next);
                  }}
                  style={inputStyle}
                />
              </label>
              <label className="v3-stack">
                <span>당구장명</span>
                <input
                  value={row.name}
                  onChange={(e) => {
                    const next = [...extraVenues];
                    next[idx] = { ...next[idx]!, name: e.target.value };
                    setExtraVenues(next);
                  }}
                  style={inputStyle}
                />
              </label>
              <label className="v3-stack">
                <span>전화번호</span>
                <input
                  value={row.phone}
                  onChange={(e) => {
                    const next = [...extraVenues];
                    next[idx] = { ...next[idx]!, phone: e.target.value };
                    setExtraVenues(next);
                  }}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                className="v3-btn"
                style={{ alignSelf: "flex-start", padding: "0.35rem 0.6rem" }}
                onClick={() => setExtraVenues((r) => r.filter((_, i) => i !== idx))}
              >
                삭제
              </button>
            </div>
          ))}
        </section>

        {/* 10. 참가 조건 (자격 + 증빙) */}
        <section className="v3-box v3-stack" aria-label="참가 조건" style={{ gap: "0.75rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            10. 참가 조건
          </h2>
          <div className="v3-stack" style={{ gap: "0.35rem" }}>
            <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
              참가 자격
            </span>
            <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
              {EQ_OPTIONS.map((o) => (
                <label key={o.value} className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
                  <input
                    type="radio"
                    name="entryQualificationType"
                    checked={entryQualificationType === o.value}
                    onChange={() => setEntryQualificationType(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="v3-stack" style={{ flex: "1 1 14rem" }}>
              <span>점수 또는 에버(스카치 접수시 합산점수 입력)</span>
              <input
                inputMode="decimal"
                disabled={entryQualificationType === "NONE"}
                value={qualificationValue}
                onChange={(e) => setQualificationValue(e.target.value)}
                placeholder={
                  entryQualificationType === "NONE" ? "—" : "0.80 of 27 형식으로 숫자만 입력하세요"
                }
                style={{
                  ...inputStyle,
                  opacity: entryQualificationType === "NONE" ? 0.5 : 1,
                }}
              />
            </label>
            <div className="v3-stack" style={{ gap: "0.35rem" }} role="group" aria-label="에버·점수 이하 또는 미만">
              <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
                  <input
                    type="radio"
                    name="eligibilityCompare"
                    checked={eligibilityCompare === "LTE"}
                    disabled={entryQualificationType === "NONE"}
                    onChange={() => setEligibilityCompare("LTE")}
                  />
                  <span style={{ opacity: entryQualificationType === "NONE" ? 0.5 : 1 }}>이하</span>
                </label>
                <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
                  <input
                    type="radio"
                    name="eligibilityCompare"
                    checked={eligibilityCompare === "LT"}
                    disabled={entryQualificationType === "NONE"}
                    onChange={() => setEligibilityCompare("LT")}
                  />
                  <span style={{ opacity: entryQualificationType === "NONE" ? 0.5 : 1 }}>미만</span>
                </label>
              </div>
            </div>
          </div>

          <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={verificationRequested}
              onChange={(e) => {
                const on = e.target.checked;
                setVerificationRequested(on);
                if (!on) {
                  setVerificationMode("NONE");
                } else {
                  setVerificationMode((m) => (m === "NONE" ? "AUTO" : m));
                  setVerificationGuideText((t) =>
                    t.trim() === "" ? DEFAULT_VERIFICATION_GUIDE_TEXT : t
                  );
                }
              }}
            />
            <span>증빙 요청</span>
          </label>
          {verificationRequested ? (
            <div className="v3-stack" style={{ gap: "0.65rem" }}>
              <label className="v3-stack" style={{ maxWidth: "14rem" }}>
                <span>방식</span>
                <select
                  value={verificationMode === "MANUAL" ? "MANUAL" : "AUTO"}
                  onChange={(e) => setVerificationMode(e.target.value as TournamentVerificationMode)}
                  style={inputStyle}
                >
                  <option value="AUTO">자동(OCR)</option>
                  <option value="MANUAL">수동확인</option>
                </select>
              </label>
              <textarea
                rows={3}
                aria-label="증빙 안내 문구"
                value={verificationGuideText}
                onChange={(e) => setVerificationGuideText(e.target.value)}
                placeholder={DEFAULT_VERIFICATION_GUIDE_TEXT}
                style={inputStyle}
              />
            </div>
          ) : null}
        </section>

        {/* 11. 대회요강 / 대회장소 CTA */}
        <section className="v3-box v3-stack" aria-label="대회요강 및 장소 안내" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
            11. 대회요강 · 대회 장소 안내
          </h2>
          <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            대회요강은 선택 사항입니다. 표시 방식을 바꿔도 직접 입력 내용은 유지됩니다.
          </p>
          <OutlineContentEditor
            heading="대회요강"
            displayMode={outlineDisplayMode}
            onDisplayModeChange={setOutlineDisplayMode}
            outlineHtml={outlineHtml}
            onOutlineHtmlChange={setOutlineHtml}
            outlineImageUrl={outlineImageUrl}
            onOutlineImageUrlChange={setOutlineImageUrl}
            outlinePdfUrl={outlinePdfUrl}
            onOutlinePdfUrlChange={setOutlinePdfUrl}
            compact={outlineEditorCompact}
            imageUploadSitePublic
          />
          <div className="v3-stack" style={{ gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>대회 장소 안내 (당구장 페이지)</span>
            <p className="v3-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
              위 <strong>장소</strong> 문구와 별도로, 계정에 등록된 소속 당구장 안내 페이지로만 연결할 수 있습니다.
            </p>
            {creatorVenueId ? (
              <>
                <label className="v3-stack" style={{ gap: "0.35rem", maxWidth: "28rem" }}>
                  <span>CTA 연결</span>
                  <select
                    value={venueCtaMode}
                    onChange={(e) => setVenueCtaMode(e.target.value as "creator" | "none")}
                    style={inputStyle}
                  >
                    <option value="creator">
                      내 당구장 ({getSiteVenueById(creatorVenueId)?.name ?? creatorVenueId})
                    </option>
                    <option value="none">선택 없음</option>
                  </select>
                </label>
                {venueCtaMode === "creator" ? (
                  <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Link
                      className="v3-btn"
                      href={buildSiteVenueDetailPath(creatorVenueId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "0.45rem 0.85rem" }}
                    >
                      당구장 안내 페이지 미리보기
                    </Link>
                    <span className="v3-muted" style={{ fontSize: "0.8rem" }}>
                      {buildSiteVenueDetailPath(creatorVenueId)}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                계정에 등록된 소속 당구장이 없어 CTA를 연결할 수 없습니다. (선택 없음으로 저장됩니다.)
              </p>
            )}
          </div>
        </section>

        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
          <button
            type="submit"
            className="v3-btn"
            disabled={loading || (Boolean(editId) && editLoading)}
            style={{ padding: "0.75rem 1rem" }}
          >
            {loading ? (editId ? "저장 중…" : "생성 중…") : editId ? "변경 저장" : "대회 생성"}
          </button>
          {saveState !== "idle" ? (
            <span
              className="v3-muted"
              style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280" }}
            >
              {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
            </span>
          ) : null}
          <button
            type="button"
            className="v3-btn"
            disabled={loading || (Boolean(editId) && editLoading)}
            style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #bbb" }}
            onClick={handleCancelClick}
          >
            취소
          </button>
        </div>
      </form>

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
          <div className="v3-box v3-stack" style={{ maxWidth: "22rem", width: "100%", gap: "1rem" }}>
            <p id="leave-confirm-title" style={{ margin: 0, lineHeight: 1.5 }}>
              작성 중인 내용이 삭제됩니다. 나가시겠습니까?
            </p>
            <div className="v3-row" style={{ gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" style={{ background: "#fff", border: "1px solid #bbb" }} onClick={() => setLeaveConfirmOpen(false)}>
                취소
              </button>
              <button type="button" className="v3-btn" onClick={handleConfirmLeave}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

        </>
      )}
    </main>
  );
}
