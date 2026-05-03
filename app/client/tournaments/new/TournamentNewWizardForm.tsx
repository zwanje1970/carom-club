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
  "대회명 · 설명",
  "모집 인원",
  "대회 종류 · 범위 · 참가 자격",
  "날짜 · 장소",
  "대회 포스터",
  "상금",
  "참가비 · 입금",
  "증빙 · 대회요강 · 안내",
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
  prize3a: string;
  setPrize3a: Dispatch<SetStateAction<string>>;
  prize3b: string;
  setPrize3b: Dispatch<SetStateAction<string>>;
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
    prize3a,
    setPrize3a,
    prize3b,
    setPrize3b,
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
  } = p;

  const step = wizardStep;
  const canPrev = step > 1;
  const canNext = step < TOURNAMENT_CREATE_WIZARD_COUNT;

  return (
    <form className="v3-stack" style={sectionGap} onSubmit={onSubmit} noValidate>
      <nav aria-label="대회 입력 단계" className={`${adminUi.surface} v3-stack`} style={{ gap: "0.45rem", padding: "0.65rem 0.75rem" }}>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
          {TOURNAMENT_CREATE_WIZARD_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = step > n;
            const active = step === n;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setWizardStep(n)}
                className="v3-btn"
                aria-current={active ? "step" : undefined}
                style={{
                  padding: "0.28rem 0.5rem",
                  fontSize: "0.78rem",
                  fontWeight: active ? 800 : done ? 600 : 500,
                  background: active ? "#dbeafe" : done ? "#f1f5f9" : "#fff",
                  borderColor: active ? "#2563eb" : "#d1d5db",
                  color: active ? "#1e3a8a" : "#374151",
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
          현재: <strong>{step}</strong>단계 — {TOURNAMENT_CREATE_WIZARD_LABELS[step - 1]}
        </p>
      </nav>

      {step === 1 ? (
        <section id="wizard-step-1" className={`${adminUi.surface} v3-stack`} aria-label="대회명과 설명" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            1. 대회명 · 대회 설명
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

      {step === 2 ? (
        <section id="wizard-step-2" className={`${adminUi.surface} v3-stack`} aria-label="모집 인원" style={{ gap: "0.7rem" }}>
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

      {step === 3 ? (
        <section id="wizard-step-3" className={`${adminUi.surface} v3-stack`} aria-label="대회 종류 범위 참가 자격" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            3. 대회 종류 · 범위 · 참가 자격
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

      {step === 4 ? (
        <section id="wizard-step-4" className={`${adminUi.surface} v3-stack`} aria-label="날짜와 장소" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            4. 날짜 · 장소
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
          <p className="v3-muted" style={{ fontSize: "0.82rem", margin: 0, borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem" }}>
            상호를 입력하면 등록된 당구장을 검색할 수 있습니다. 목록에서 선택하면 상호·주소·전화가 줄 단위로 채워집니다.
          </p>
          <div ref={venueSearchWrapRef} className="v3-stack" style={{ gap: "0.35rem", position: "relative" }}>
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

      {step === 5 ? (
        <section id="wizard-step-5" className={`${adminUi.surface} v3-stack`} aria-label="대회 포스터" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            5. 대회 포스터 (선택)
          </h2>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            포스터를 올리면 대회 안내에 함께 표시됩니다. 건너뛰어도 나중에 대회 상세에서 추가할 수 있습니다.
          </p>
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

      {step === 6 ? (
        <section id="wizard-step-6" className={`${adminUi.surface} v3-stack`} aria-label="상금" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            6. 상금
          </h2>
          <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            여러 줄로 합쳐 저장됩니다. (1등 / 2등 / 3등 / 3등 / 기타)
          </p>
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
            <textarea rows={2} value={prizeExtra} onChange={(e) => setPrizeExtra(e.target.value)} placeholder="4위 이하, 특별상 등" style={inputStyle} />
          </label>
        </section>
      ) : null}

      {step === 7 ? (
        <section id="wizard-step-7" className={`${adminUi.surface} v3-stack`} aria-label="참가비와 입금" style={{ gap: "0.7rem" }}>
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

      {step === 8 ? (
        <section id="wizard-step-8" className={`${adminUi.surface} v3-stack`} aria-label="증빙과 대회요강" style={{ gap: "0.7rem" }}>
          <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0, marginBottom: "0.55rem" }}>
            8. 증빙 확인 · 대회요강 · 장소 안내
          </h2>
          <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            증빙은 참가 신청 시 <strong>이미지 첨부</strong>로 받습니다. 증빙을 쓰지 않으면 아래에서 「확인 안 함」만 선택하면 됩니다.
          </p>
          <div
            id="wiz-verify-policy"
            tabIndex={-1}
            className="v3-row"
            style={{ gap: "0.5rem", flexWrap: "wrap", outline: "none" }}
          >
            <button
              type="button"
              className="v3-btn"
              style={{ padding: "0.45rem 0.75rem", background: !verificationRequested ? "#dbeafe" : "#fff" }}
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
              style={{ padding: "0.45rem 0.75rem", background: verificationRequested ? "#dbeafe" : "#fff" }}
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
          <div className="v3-stack" style={{ gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
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
          <div className="v3-stack" style={{ gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>대회 장소 안내 (당구장 페이지)</span>
            <p className="v3-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
              위 <strong>장소</strong> 문구와 별도로, 계정에 등록된 소속 당구장 안내 페이지로만 연결할 수 있습니다.
            </p>
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
            ) : (
              <p className="v3-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                계정에 등록된 소속 당구장이 없어 CTA를 연결할 수 없습니다. (선택 없음으로 저장됩니다.)
              </p>
            )}
          </div>
        </section>
      ) : null}

      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
        <button type="button" className="v3-btn" disabled={!canPrev || loading || editLoading} style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #bbb" }} onClick={() => setWizardStep((s) => Math.max(1, s - 1))}>
          이전 단계
        </button>
        {canNext ? (
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
          <button type="submit" className="v3-btn" disabled={loading || editLoading} style={{ padding: "0.75rem 1rem" }}>
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
