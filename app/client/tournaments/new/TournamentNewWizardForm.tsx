"use client";

import Link from "next/link";
import type { CSSProperties, Dispatch, FormEvent, MutableRefObject, SetStateAction } from "react";
import adminUi from "../../../components/admin/admin-card.module.css";
import OutlineContentEditor from "../../../../components/shared/outline/OutlineContentEditor";
import type { OutlineDisplayMode } from "../../../../lib/outline-content-types";
import { buildSiteVenueDetailPath, getSiteVenueById } from "../../../../lib/site-venues-catalog";
import type {
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../../../../lib/tournament-rule-types";

const DEFAULT_VERIFICATION_GUIDE_TEXT = "에버리지 인증서, 또는 경기기록을 첨부하세요";

const EQ_OPTIONS: { value: TournamentEntryQualificationType; label: string }[] = [
  { value: "NONE", label: "관계없음" },
  { value: "EVER", label: "에버기준" },
  { value: "SCORE", label: "점수기준" },
];

export const TOURNAMENT_CREATE_WIZARD_LABELS = [
  "기본정보",
  "모집 인원",
  "종목 · 범위 · 참가 자격",
  "일정 · 장소",
  "대회 포스터",
  "상금",
  "참가비 · 입금",
  "증빙 확인",
  "대회요강 · 장소 안내",
] as const;

export const TOURNAMENT_CREATE_WIZARD_COUNT = TOURNAMENT_CREATE_WIZARD_LABELS.length;

export type TournamentNewWizardFormProps = {
  inputStyle: CSSProperties;
  sectionGap: CSSProperties;
  wizardStep: number;
  setWizardStep: Dispatch<SetStateAction<number>>;
  editId: string | null;
  editLoading: boolean;
  loading: boolean;
  /** 신규 생성 최종 확인 모달이 열린 동안 제출 버튼 비활성(중복 제출 방지) */
  createConfirmPending?: boolean;
  saveState: "idle" | "saving" | "success" | "error";
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancelClick: () => void;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  tournamentIntro: string;
  setTournamentIntro: Dispatch<SetStateAction<string>>;
  maxParticipants: string;
  setMaxParticipants: Dispatch<SetStateAction<string>>;
  isScotch: boolean;
  setIsScotch: Dispatch<SetStateAction<boolean>>;
  scope: TournamentScope;
  setScope: Dispatch<SetStateAction<TournamentScope>>;
  zonesEnabled: boolean;
  setZonesEnabled: Dispatch<SetStateAction<boolean>>;
  allowMultipleSlots: boolean;
  setAllowMultipleSlots: Dispatch<SetStateAction<boolean>>;
  participantsListPublic: boolean;
  setParticipantsListPublic: Dispatch<SetStateAction<boolean>>;
  entryQualificationType: TournamentEntryQualificationType;
  setEntryQualificationType: Dispatch<SetStateAction<TournamentEntryQualificationType>>;
  qualificationValue: string;
  setQualificationValue: Dispatch<SetStateAction<string>>;
  eligibilityCompare: TournamentTeamScoreRule;
  setEligibilityCompare: Dispatch<SetStateAction<TournamentTeamScoreRule>>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  durationType: TournamentDurationType;
  setDurationType: Dispatch<SetStateAction<TournamentDurationType>>;
  durationDays: number;
  setDurationDays: Dispatch<SetStateAction<number>>;
  extraDays: string[];
  setExtraDays: Dispatch<SetStateAction<string[]>>;
  withWeekdayLabel: (raw: string) => string;
  locLine1: string;
  setLocLine1: Dispatch<SetStateAction<string>>;
  locLine2: string;
  setLocLine2: Dispatch<SetStateAction<string>>;
  locLine3: string;
  setLocLine3: Dispatch<SetStateAction<string>>;
  venueSearchWrapRef: MutableRefObject<HTMLDivElement | null>;
  venueSearchOpen: boolean;
  setVenueSearchOpen: Dispatch<SetStateAction<boolean>>;
  venueSearchResults: { venueId: string; name: string; addressLine: string; phone: string | null }[];
  setPickedVenueGuideId: Dispatch<SetStateAction<string | null>>;
  extraVenues: { address: string; name: string; phone: string }[];
  setExtraVenues: Dispatch<SetStateAction<{ address: string; name: string; phone: string }[]>>;
  posterInputRef: MutableRefObject<HTMLInputElement | null>;
  posterObjectPreviewUrl: string;
  posterImageUrl: string;
  posterVisibleUsesServerUrl: boolean;
  posterUploading: boolean;
  posterNotice: string;
  posterImgSrc: string;
  posterNormalizedForDisplay: string;
  onPosterFileChange: (fileList: FileList | null) => void;
  setPosterObjectPreviewUrl: Dispatch<SetStateAction<string>>;
  setPosterImageUrl: Dispatch<SetStateAction<string>>;
  setPosterVisibleUsesServerUrl: Dispatch<SetStateAction<boolean>>;
  setPosterNotice: Dispatch<SetStateAction<string>>;
  prize1: string;
  setPrize1: Dispatch<SetStateAction<string>>;
  prize2: string;
  setPrize2: Dispatch<SetStateAction<string>>;
  prize3: string;
  setPrize3: Dispatch<SetStateAction<string>>;
  prize4: string;
  setPrize4: Dispatch<SetStateAction<string>>;
  prizeThirdShared: boolean;
  setPrizeThirdShared: Dispatch<SetStateAction<boolean>>;
  prizeExtra: string;
  setPrizeExtra: Dispatch<SetStateAction<string>>;
  prizeAmountDigitsOnly: (raw: string) => string;
  entryFee: string;
  setEntryFee: Dispatch<SetStateAction<string>>;
  accountNumber: string;
  setAccountNumber: Dispatch<SetStateAction<string>>;
  verificationRequested: boolean;
  setVerificationRequested: Dispatch<SetStateAction<boolean>>;
  verificationMode: TournamentVerificationMode;
  setVerificationMode: Dispatch<SetStateAction<TournamentVerificationMode>>;
  verificationGuideText: string;
  setVerificationGuideText: Dispatch<SetStateAction<string>>;
  /** 증빙 정책 버튼 중 하나를 사용자가 눌렀을 때만 true — 미선택 시 둘 다 비강조 */
  step8PolicyAcknowledged: boolean;
  outlineDisplayMode: OutlineDisplayMode;
  setOutlineDisplayMode: Dispatch<SetStateAction<OutlineDisplayMode>>;
  outlineHtml: string;
  setOutlineHtml: Dispatch<SetStateAction<string>>;
  outlineImageUrl: string;
  setOutlineImageUrl: Dispatch<SetStateAction<string>>;
  outlinePdfUrl: string;
  setOutlinePdfUrl: Dispatch<SetStateAction<string>>;
  outlineEditorCompact: boolean;
  creatorVenueId: string | null;
  venueCtaMode: "creator" | "none";
  setVenueCtaMode: Dispatch<SetStateAction<"creator" | "none">>;
  onStep8PolicyInteract: () => void;
  /** 수정 화면: 전체 문서형 — 모든 섹션 표시, 상단 버튼은 목차(스크롤 이동) */
  wizardNavigationMode?: "stepper" | "toc";
};

export default function TournamentNewWizardForm(p: TournamentNewWizardFormProps) {
  const {
    inputStyle,
    sectionGap,
    wizardStep,
    setWizardStep,
    editId,
    editLoading,
    loading,
    createConfirmPending = false,
    saveState,
    onSubmit,
    onCancelClick,
    title,
    setTitle,
    tournamentIntro,
    setTournamentIntro,
    maxParticipants,
    setMaxParticipants,
    isScotch,
    setIsScotch,
    scope,
    setScope,
    zonesEnabled,
    setZonesEnabled,
    allowMultipleSlots,
    setAllowMultipleSlots,
    participantsListPublic,
    setParticipantsListPublic,
    entryQualificationType,
    setEntryQualificationType,
    qualificationValue,
    setQualificationValue,
    eligibilityCompare,
    setEligibilityCompare,
    date,
    setDate,
    durationType,
    setDurationType,
    durationDays,
    setDurationDays,
    extraDays,
    setExtraDays,
    withWeekdayLabel,
    locLine1,
    setLocLine1,
    locLine2,
    setLocLine2,
    locLine3,
    setLocLine3,
    venueSearchWrapRef,
    venueSearchOpen,
    setVenueSearchOpen,
    venueSearchResults,
    setPickedVenueGuideId,
    extraVenues,
    setExtraVenues,
    posterInputRef,
    posterObjectPreviewUrl,
    posterImageUrl,
    posterVisibleUsesServerUrl,
    posterUploading,
    posterNotice,
    posterImgSrc,
    posterNormalizedForDisplay,
    onPosterFileChange,
    setPosterObjectPreviewUrl,
    setPosterImageUrl,
    setPosterVisibleUsesServerUrl,
    setPosterNotice,
    prize1,
    setPrize1,
    prize2,
    setPrize2,
    prize3,
    setPrize3,
    prize4,
    setPrize4,
    prizeThirdShared,
    setPrizeThirdShared,
    prizeExtra,
    setPrizeExtra,
    prizeAmountDigitsOnly,
    entryFee,
    setEntryFee,
    accountNumber,
    setAccountNumber,
    verificationRequested,
    setVerificationRequested,
    verificationMode,
    setVerificationMode,
    verificationGuideText,
    setVerificationGuideText,
    step8PolicyAcknowledged,
    outlineDisplayMode,
    setOutlineDisplayMode,
    outlineHtml,
    setOutlineHtml,
    outlineImageUrl,
    setOutlineImageUrl,
    outlinePdfUrl,
    setOutlinePdfUrl,
    outlineEditorCompact,
    creatorVenueId,
    venueCtaMode,
    setVenueCtaMode,
    onStep8PolicyInteract,
    wizardNavigationMode = "stepper",
  } = p;

  const step = wizardStep;
  const tocMode = wizardNavigationMode === "toc";
  const sectionVisible = (n: number) => tocMode || step === n;
  const sectionScrollPad = tocMode ? ({ scrollMarginTop: "0.85rem" } as const) : {};
  const canPrev = step > 1;
  const canNext = step < TOURNAMENT_CREATE_WIZARD_COUNT;

  return (
    <form className="v3-stack" style={sectionGap} onSubmit={onSubmit} noValidate>
      <nav
        aria-label={tocMode ? "대회 수정 목차" : "대회 입력 단계"}
        className={`${adminUi.surface} v3-stack`}
        style={{ gap: "0.45rem", padding: "0.65rem 0.75rem" }}
      >
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
          {TOURNAMENT_CREATE_WIZARD_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = !tocMode && step > n;
            const active = !tocMode && step === n;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (tocMode) {
                    document.getElementById(`wizard-step-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    setWizardStep(n);
                  }
                }}
                className="v3-btn"
                aria-current={active ? "step" : undefined}
                style={{
                  padding: "0.28rem 0.5rem",
                  fontSize: "0.78rem",
                  fontWeight: tocMode ? 600 : active ? 800 : done ? 600 : 500,
                  background: tocMode ? "#f8fafc" : active ? "#dbeafe" : done ? "#f1f5f9" : "#fff",
                  borderColor: tocMode ? "#e2e8f0" : active ? "#2563eb" : "#d1d5db",
                  color: tocMode ? "#334155" : active ? "#1e3a8a" : "#374151",
                  borderRadius: "999px",
                }}
              >
                {n}. {label}
                {done ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          {tocMode ? (
            <>
              상단 항목을 누르면 해당 위치로 스크롤됩니다. 아래 전체 내용을 한 화면에서 수정할 수 있습니다.
            </>
          ) : (
            <>
              현재: <strong>{step}</strong>단계 — {TOURNAMENT_CREATE_WIZARD_LABELS[step - 1]}
            </>
          )}
        </p>
      </nav>

      {sectionVisible(1) ? (
        <section
          id="wizard-step-1"
          className={`${adminUi.surface} v3-stack`}
          aria-label="대회명과 설명"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            1. 기본정보
          </h2>
          <label className="v3-stack">
            <span>대회명</span>
            <input
              id="wiz-title"
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
      ) : null}

      {sectionVisible(2) ? (
        <section
          id="wizard-step-2"
          className={`${adminUi.surface} v3-stack`}
          aria-label="모집 인원"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            2. 모집 인원
          </h2>
          <label className="v3-stack" style={{ maxWidth: "12rem" }}>
            <span>모집 인원</span>
            <input
              id="wiz-max"
              type="number"
              min={1}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              style={inputStyle}
            />
          </label>
        </section>
      ) : null}

      {sectionVisible(3) ? (
        <section
          id="wizard-step-3"
          className={`${adminUi.surface} v3-stack`}
          aria-label="대회 종류 범위 참가 자격"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            3. 종목 · 범위 · 참가 자격
          </h2>
          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
              <input type="radio" name="gameKind" checked={!isScotch} onChange={() => setIsScotch(false)} />
              <span>일반</span>
            </label>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
              <input type="radio" name="gameKind" checked={isScotch} onChange={() => setIsScotch(true)} />
              <span>스카치</span>
            </label>
          </div>
          {isScotch ? (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              스카치 시 합산 점수·에버는 아래 「참가 자격」에서 입력합니다.
            </p>
          ) : null}
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="v3-stack" style={{ flex: "1 1 12rem" }}>
              <span>대회 범위</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as TournamentScope)} style={inputStyle}>
                <option value="REGIONAL">단일대회(당구장대회)</option>
                <option value="NATIONAL">권역대회(합동·전국대회)</option>
              </select>
            </label>
          </div>
          <div
            className="v3-stack"
            style={{ gap: "0.35rem", marginTop: "0.45rem", paddingTop: "0.65rem", borderTop: "1px solid #e2e8f0" }}
          >
            <label className="v3-row" style={{ alignItems: "flex-start", gap: "0.55rem" }}>
              <input type="checkbox" checked={zonesEnabled} onChange={(e) => setZonesEnabled(e.target.checked)} />
              <span className="v3-stack" style={{ gap: "0.15rem" }}>
                <span style={{ fontWeight: 700 }}>권역 운영 사용</span>
                <span className="v3-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                  권역별로 참가자와 대진표를 분리 운영합니다.
                </span>
              </span>
            </label>
          </div>
          <div className="v3-row" style={{ gap: "1.25rem", flexWrap: "wrap" }}>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={allowMultipleSlots} onChange={(e) => setAllowMultipleSlots(e.target.checked)} />
              <span>중복 참가 허용</span>
            </label>
            <label className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={participantsListPublic} onChange={(e) => setParticipantsListPublic(e.target.checked)} />
              <span>참가자 명단 공개</span>
            </label>
          </div>
          <div className="v3-stack" style={{ gap: "0.35rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem" }}>
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
                id="wiz-qual"
                inputMode="decimal"
                disabled={entryQualificationType === "NONE"}
                value={qualificationValue}
                onChange={(e) => setQualificationValue(e.target.value)}
                placeholder={entryQualificationType === "NONE" ? "—" : "0.80 of 27 형식으로 숫자만 입력하세요"}
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
        </section>
      ) : null}

      {sectionVisible(4) ? (
        <section
          id="wizard-step-4"
          className={`${adminUi.surface} v3-stack`}
          aria-label="날짜와 장소"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            4. 일정 · 장소
          </h2>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="v3-stack" style={{ flex: "1 1 11rem" }}>
              <span>{durationType === "MULTI_DAY" ? "시작일 (1일차)" : "대회 날짜"}</span>
              <input id="wiz-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
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
                    id={idx === 0 ? "wiz-extra-day-0" : undefined}
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
          <div ref={venueSearchWrapRef} className="v3-stack" style={{ gap: "0.35rem", position: "relative", borderTop: "1px solid #e2e8f0", paddingTop: "0.55rem" }}>
            <label className="v3-stack">
              <span>상호</span>
              <input
                id="wiz-loc1"
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
            onClick={() => setExtraVenues((rows) => [...rows, { address: "", name: "", phone: "" }])}
          >
            대회장 추가
          </button>
          {extraVenues.map((row, idx) => (
            <div key={idx} className="v3-stack" style={{ gap: "0.4rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem" }}>
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
              <button type="button" className="v3-btn" style={{ alignSelf: "flex-start", padding: "0.35rem 0.6rem" }} onClick={() => setExtraVenues((r) => r.filter((_, i) => i !== idx))}>
                삭제
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {sectionVisible(5) ? (
        <section
          id="wizard-step-5"
          className={`${adminUi.surface} v3-stack`}
          aria-label="대회 포스터"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            5. 대회 포스터 (선택)
          </h2>
          <input
            ref={posterInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => void onPosterFileChange(e.target.files)}
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
              <img src={posterImgSrc} alt="대회 포스터 미리보기" decoding="async" style={{ maxWidth: "100%", maxHeight: "14rem", objectFit: "contain", borderRadius: "0.35rem" }} />
              <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="v3-btn" style={{ padding: "0.4rem 0.75rem" }} onClick={() => posterInputRef.current?.click()} disabled={posterUploading}>
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
              {posterUploading ? "업로드 중…" : "클릭하여 포스터 이미지 선택 (jpg / jpeg / png / webp)"}
            </button>
          )}
          {posterNotice ? (
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              {posterNotice}
            </p>
          ) : null}
        </section>
      ) : null}

      {sectionVisible(6) ? (
        <section id="wizard-step-6" className={`${adminUi.surface} v3-stack`} aria-label="상금" style={{ gap: "0.7rem", ...sectionScrollPad }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            6. 상금
          </h2>
          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
              <span>1등</span>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                <input
                  id="wiz-prize1"
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
                  value={prize3}
                  onChange={(e) => setPrize3(prizeAmountDigitsOnly(e.target.value))}
                  placeholder="상금 (만원 단위, 숫자만 입력)"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 0", minWidth: 0 }}
                />
                <span className="v3-muted" style={{ flexShrink: 0, fontSize: "0.9rem" }}>
                  만원
                </span>
                <label className="v3-row" style={{ alignItems: "center", gap: "0.25rem", marginLeft: "0.3rem", flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={prizeThirdShared}
                    onChange={(e) => setPrizeThirdShared(e.target.checked)}
                  />
                  <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                    공동
                  </span>
                </label>
              </div>
            </label>
            {!prizeThirdShared ? (
              <label className="v3-stack" style={{ flex: "1 1 8rem" }}>
                <span>4등</span>
                <div className="v3-row" style={{ alignItems: "center", gap: "0.4rem", width: "100%" }}>
                  <input
                    value={prize4}
                    onChange={(e) => setPrize4(prizeAmountDigitsOnly(e.target.value))}
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
            ) : null}
          </div>
          <label className="v3-stack">
            <span>기타</span>
            <textarea rows={2} value={prizeExtra} onChange={(e) => setPrizeExtra(e.target.value)} placeholder="4위 이하, 특별상 등" style={inputStyle} />
          </label>
        </section>
      ) : null}

      {sectionVisible(7) ? (
        <section
          id="wizard-step-7"
          className={`${adminUi.surface} v3-stack`}
          aria-label="참가비와 입금"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            7. 참가비 · 입금 계좌
          </h2>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap" }}>
            <label className="v3-stack" style={{ flex: "1 1 10rem" }}>
              <span>참가비(원)</span>
              <input id="wiz-fee" type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} style={inputStyle} />
            </label>
            <label className="v3-stack" style={{ flex: "2 1 14rem" }}>
              <span>입금 계좌 안내</span>
              <input id="wiz-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="은행 · 계좌 · 예금주" style={inputStyle} />
            </label>
          </div>
        </section>
      ) : null}

      {sectionVisible(8) ? (
        <section
          id="wizard-step-8"
          className={`${adminUi.surface} v3-stack`}
          aria-label="증빙 확인"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            8. 증빙 확인
          </h2>
          <div
            id="wiz-verify-policy"
            tabIndex={-1}
            className="v3-row"
            style={{ gap: "0.5rem", flexWrap: "wrap", outline: "none" }}
          >
            <button
              type="button"
              className="v3-btn"
              aria-pressed={step8PolicyAcknowledged && !verificationRequested}
              style={{
                padding: "0.45rem 0.75rem",
                ...(step8PolicyAcknowledged && !verificationRequested
                  ? { background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e3a8a" }
                  : { background: "#fff", border: "1px solid #cbd5e1", color: "#334155" }),
              }}
              onClick={() => {
                onStep8PolicyInteract();
                setVerificationRequested(false);
                setVerificationMode("NONE");
              }}
            >
              증빙 확인 안 함
            </button>
            <button
              type="button"
              className="v3-btn"
              aria-pressed={step8PolicyAcknowledged && verificationRequested}
              style={{
                padding: "0.45rem 0.75rem",
                ...(step8PolicyAcknowledged && verificationRequested
                  ? { background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e3a8a" }
                  : { background: "#fff", border: "1px solid #cbd5e1", color: "#334155" }),
              }}
              onClick={() => {
                onStep8PolicyInteract();
                setVerificationRequested(true);
                setVerificationMode((m) => (m === "NONE" ? "AUTO" : m));
                setVerificationGuideText((t) => (t.trim() === "" ? DEFAULT_VERIFICATION_GUIDE_TEXT : t));
              }}
            >
              증빙 확인 함
            </button>
          </div>
          {verificationRequested ? (
            <div className="v3-stack" style={{ gap: "0.7rem" }}>
              <label className="v3-stack" style={{ maxWidth: "14rem" }}>
                <span>확인 방식</span>
                <select
                  id="wiz-verify-mode"
                  value={verificationMode === "MANUAL" ? "MANUAL" : "AUTO"}
                  onChange={(e) => setVerificationMode(e.target.value as TournamentVerificationMode)}
                  style={inputStyle}
                >
                  <option value="AUTO">OCR 자동 처리</option>
                  <option value="MANUAL">수동 확인</option>
                </select>
              </label>
              <textarea
                id="wiz-vguide"
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
      ) : null}

      {sectionVisible(9) ? (
        <section
          id="wizard-step-9"
          className={`${adminUi.surface} v3-stack`}
          aria-label="대회요강과 장소 안내"
          style={{ gap: "0.7rem", ...sectionScrollPad }}
        >
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            9. 대회요강 · 장소 안내
          </h2>
          <div className="v3-stack" style={{ gap: "0.5rem" }}>
            <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              대회요강은 선택 사항입니다.
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
          </div>
          <div className="v3-stack" style={{ gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>대회 장소 안내 (당구장 페이지)</span>
            {creatorVenueId ? (
              <>
                <label className="v3-stack" style={{ gap: "0.35rem", maxWidth: "28rem" }}>
                  <span>CTA 연결</span>
                  <select value={venueCtaMode} onChange={(e) => setVenueCtaMode(e.target.value as "creator" | "none")} style={inputStyle}>
                    <option value="creator">내 당구장 ({getSiteVenueById(creatorVenueId)?.name ?? creatorVenueId})</option>
                    <option value="none">선택 없음</option>
                  </select>
                </label>
                {venueCtaMode === "creator" ? (
                  <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Link className="v3-btn" href={buildSiteVenueDetailPath(creatorVenueId)} target="_blank" rel="noopener noreferrer" style={{ padding: "0.45rem 0.85rem" }}>
                      당구장 안내 페이지 미리보기
                    </Link>
                    <span className="v3-muted" style={{ fontSize: "0.8rem" }}>
                      {buildSiteVenueDetailPath(creatorVenueId)}
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
        {tocMode ? null : (
          <button
            type="button"
            className="v3-btn"
            disabled={!canPrev || loading || editLoading}
            style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #bbb" }}
            onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
          >
            이전 단계
          </button>
        )}
        {tocMode ? (
          <button type="submit" className="v3-btn" disabled={loading || editLoading || createConfirmPending} style={{ padding: "0.75rem 1rem" }}>
            {loading ? "저장 중…" : "변경 저장"}
          </button>
        ) : canNext ? (
          <button
            type="button"
            className="v3-btn"
            disabled={loading || editLoading}
            style={{ padding: "0.75rem 1rem" }}
            onClick={() => setWizardStep((s) => Math.min(TOURNAMENT_CREATE_WIZARD_COUNT, s + 1))}
          >
            다음 단계
          </button>
        ) : (
          <button type="submit" className="v3-btn" disabled={loading || editLoading || createConfirmPending} style={{ padding: "0.75rem 1rem" }}>
            {loading ? (editId ? "저장 중…" : "생성 중…") : editId ? "변경 저장" : "대회 생성"}
          </button>
        )}
        {saveState !== "idle" ? (
          <span className="v3-muted" style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280" }}>
            {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
          </span>
        ) : null}
        <button type="button" className="v3-btn" disabled={loading || editLoading} style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #bbb" }} onClick={onCancelClick}>
          취소
        </button>
      </div>
    </form>
  );
}
