"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import adminUi from "../../../components/admin/admin-card.module.css";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";
import type { Tournament } from "../../../../lib/types/entities";
import type {
  TournamentDivisionMetricType,
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../../../../lib/tournament-rule-types";
import SiteTournamentDetailSections from "../../../site/tournaments/[id]/site-tournament-detail-sections";

import TournamentNewWizardForm from "./TournamentNewWizardForm";

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

export default function ClientTournamentNewPage() {
  const router = useRouter();

  const [editId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const e = p.get("edit");
    return e && e.trim() ? e.trim() : null;
  });
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
  /** 새 대회 생성 직후 안내(저장은 이미 완료된 상태) */
  const [createSuccessId, setCreateSuccessId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const e = p.get("edit");
    const d = p.get("done");
    return !e && d && d.trim() ? d.trim() : null;
  });
  const [createDoneTournament, setCreateDoneTournament] = useState<Tournament | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  /** 대회 생성·수정 입력 단계(1~8). 저장 로직과 무관한 UI 상태 */
  const [wizardStep, setWizardStep] = useState(1);
  /** 신규 생성 시 증빙 정책(확인 함/안 함)을 한 번이라도 눌렀는지 — 제출 전 필수 */
  const [step8PolicyAcknowledged, setStep8PolicyAcknowledged] = useState(false);
  /** 수정 모드: 불러온 직후 폼 스냅샷(JSON) — 변경 여부 비교용 */
  const editBaselineJsonRef = useRef<string | null>(null);

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
    if (!createSuccessId) {
      setCreateDoneTournament(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${encodeURIComponent(createSuccessId)}`, {
          credentials: "same-origin",
        });
        const json = (await res.json()) as { tournament?: Tournament };
        if (cancelled) return;
        if (!res.ok || !json.tournament) return;
        setCreateDoneTournament(json.tournament);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createSuccessId]);

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

  function isNewTournamentFormPristine(): boolean {
    if (wizardStep !== 1) return false;
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
    if (zonesEnabled) return false;
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
      prize3.trim() !== "" ||
      prize4.trim() !== "" ||
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
    if (step8PolicyAcknowledged) return false;
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
    if (loading) return;

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
        router.replace(`/client/tournaments/new?done=${encodeURIComponent(savedId)}`);
      }
    } catch {
      setMessage(editId ? "저장 요청 중 오류가 발생했습니다." : "대회 생성 요청 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setLoading(false);
    }
  }

  const showCreateDone = Boolean(createSuccessId && !editId);

  const onCreateDoneDetailClickCapture = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a.primary-button--block");
      if (!anchor) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const posterNormalizedForDisplay =
    posterImageUrl.trim() !== "" ? normalizePosterImageSrcForPreview(posterImageUrl) : "";
  const posterImgSrc =
    posterObjectPreviewUrl && !posterVisibleUsesServerUrl
      ? posterObjectPreviewUrl
      : posterNormalizedForDisplay || posterObjectPreviewUrl || "";

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto", paddingTop: "0.35rem" }}>
      {editId || showCreateDone ? (
        <h1 className="v3-h1">
          {showCreateDone ? "대회 생성 완료" : "대회 수정"}
        </h1>
      ) : null}
      {showCreateDone && createDoneTournament ? (
        <div onClickCapture={onCreateDoneDetailClickCapture}>
          <SiteTournamentDetailSections
            tournament={createDoneTournament}
            audience="site"
            detailLayout="site"
            applyHref={`/site/tournaments/${createDoneTournament.id}/apply`}
            listBackHref="/site/tournaments"
          />
        </div>
      ) : null}
      <p className="v3-muted">
        {showCreateDone
          ? "대회 정보는 이미 저장되었습니다. 다음 단계는 선택입니다."
          : editId
            ? "기존 대회 정보를 불러왔습니다. 수정 후 저장하면 동일 대회에 반영됩니다."
            : "대회 생성은 8단계 순서로 진행합니다. 한 번에 하나의 단계만 펼쳐지며, 저장은 마지막 단계에서만 할 수 있습니다. 필수 항목이 비어 있으면 저장되지 않고 해당 단계로 이동합니다."}
      </p>

      {editId && editLoading ? (
        <p className="v3-muted" role="status">
          대회 정보를 불러오는 중…
        </p>
      ) : null}

      {showCreateDone && createSuccessId ? null : (
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
      />

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
