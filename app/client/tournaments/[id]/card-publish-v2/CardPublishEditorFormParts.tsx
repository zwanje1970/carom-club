"use client";

import { memo, type ChangeEvent, type RefObject } from "react";
import editorStyles from "../card-publish-editor.module.css";

/** 게시카드 편집기 v2 글자색 12색 — 1열·우측 정렬(요청 순서) */
export const CARD_EDITOR_TEXT_COLOR_SWATCHES = [
  "#ffffff",
  "#ffff00",
  "#eab308",
  "#ea580c",
  "#84cc16",
  "#16a34a",
  "#14b8a6",
  "#7dd3fc",
  "#2563eb",
  "#c4b5fd",
  "#7c3aed",
  "#0a0a0a",
] as const;

export const TextColorSwatches = memo(function TextColorSwatches({
  value,
  onChange,
  wrapClass,
  swatchClass,
  swatchLightClass,
  swatchSelectedClass,
  swatchCompactClass,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  wrapClass: string;
  swatchClass: string;
  swatchLightClass: string;
  swatchSelectedClass: string;
  /** 12색 한 줄용 작은 스와치 */
  swatchCompactClass?: string;
  disabled?: boolean;
}) {
  return (
    <div className={wrapClass} role="group" aria-label="글자색">
      {CARD_EDITOR_TEXT_COLOR_SWATCHES.map((hex) => {
        const selected = value.trim().toLowerCase() === hex.toLowerCase();
        const isLight = hex.toLowerCase() === "#ffffff";
        return (
          <button
            key={hex}
            type="button"
            className={`${swatchClass} ${swatchCompactClass ?? ""} ${isLight ? swatchLightClass : ""} ${selected ? swatchSelectedClass : ""}`.trim()}
            style={{ backgroundColor: hex }}
            aria-label={`색 ${hex}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? "" : hex)}
          />
        );
      })}
    </div>
  );
});

/** 카드 배경색 팔레트 (32색) — page와 동일 목록 */
export const CARD_COLOR_PALETTE_32 = [
  "#FFFFFF",
  "#F3F4F6",
  "#9CA3AF",
  "#6B7280",
  "#374151",
  "#171717",
  "#FECACA",
  "#DC2626",
  "#FDBA74",
  "#EA580C",
  "#FDE68A",
  "#EAB308",
  "#CA8A04",
  "#BBF7D0",
  "#84CC16",
  "#4ADE80",
  "#16A34A",
  "#6EE7B7",
  "#14B8A6",
  "#22D3EE",
  "#38BDF8",
  "#0EA5E9",
  "#60A5FA",
  "#2563EB",
  "#1E40AF",
  "#1E3A8A",
  "#818CF8",
  "#6366F1",
  "#A78BFA",
  "#9333EA",
  "#F0ABFC",
  "#EC4899",
] as const;

const OpacitySliderRow = memo(function OpacitySliderRow({
  label,
  value01,
  onChange,
  min = 0,
  max = 100,
  disabled = false,
  ariaLabel,
}: {
  label: string;
  value01: number;
  onChange: (next01: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const percent = Math.round(value01 * 100);
  return (
    <div className={editorStyles.rangeBlock}>
      <span className={`${editorStyles.fieldLabel} ${editorStyles.fieldLabelRow}`}>
        {label}
        <output className={editorStyles.rangeOut}>{percent}%</output>
      </span>
      <input
        className={editorStyles.range}
        type="range"
        min={min}
        max={max}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </div>
  );
});

export const CardPublishBackgroundTab = memo(function CardPublishBackgroundTab({
  mediaBackground,
  onPickPaletteColor,
  bgFileInputRef,
  onBackgroundFileChange,
  onClearBackgroundFileSelection,
  uploadedImage,
  imageOverlayOpacity,
  onImageOverlayChange,
  bottomBarColor,
  onPickBottomBarColor,
  bottomBarOpacity,
  onBottomBarOpacityChange,
  gradientPreset,
  onGradientPresetChange,
  gradientOpacity,
  onGradientOpacityChange,
  disabled = false,
}: {
  mediaBackground: string;
  onPickPaletteColor: (hex: string) => void;
  bgFileInputRef: RefObject<HTMLInputElement | null>;
  onBackgroundFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearBackgroundFileSelection: () => void;
  uploadedImage: { w320Url: string } | null;
  imageOverlayOpacity: number;
  onImageOverlayChange: (opacity01: number) => void;
  bottomBarColor: string;
  onPickBottomBarColor: (hex: string) => void;
  bottomBarOpacity: number;
  onBottomBarOpacityChange: (opacity01: number) => void;
  gradientPreset: "none" | "top" | "left" | "top_left" | "soft";
  onGradientPresetChange: (preset: "none" | "top" | "left" | "top_left" | "soft") => void;
  gradientOpacity: number;
  onGradientOpacityChange: (opacity01: number) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>카드 배경색</span>
        <div className={editorStyles.colorPaletteGrid}>
          {CARD_COLOR_PALETTE_32.map((hex, index) => {
            const selected = mediaBackground.trim().toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={`card-color-${index}-${hex}`}
                type="button"
                aria-label={`배경색 ${hex}`}
                className="card-publish-color-swatch"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  border: "none",
                  borderRadius: 7,
                  backgroundColor: hex,
                  cursor: disabled ? "default" : "pointer",
                  boxSizing: "border-box",
                  outline: selected ? "2px solid #ffffff" : "none",
                  boxShadow: selected ? "0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)" : "none",
                }}
                disabled={disabled}
                onClick={() => onPickPaletteColor(hex)}
              />
            );
          })}
        </div>
      </div>

      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>배경 이미지</span>
        <div className={editorStyles.bgRow}>
          <input
            ref={bgFileInputRef}
            className={editorStyles.fieldFile}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={onBackgroundFileChange}
          />
          <button
            type="button"
            className={editorStyles.clearBtn}
            style={{ marginTop: 0 }}
            disabled={disabled}
            onClick={onClearBackgroundFileSelection}
          >
            선택해제
          </button>
        </div>
        <OpacitySliderRow
          label="배경그림 투명도"
          value01={imageOverlayOpacity}
          min={15}
          max={100}
          disabled={disabled || !uploadedImage}
          ariaLabel="배경그림 투명도"
          onChange={onImageOverlayChange}
        />
      </div>

      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>하단 영역 색상</span>
        <div className={editorStyles.colorPaletteGrid}>
          {CARD_COLOR_PALETTE_32.map((hex, index) => {
            const selected = bottomBarColor.trim().toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={`card-bottom-color-${index}-${hex}`}
                type="button"
                aria-label={`하단 영역색 ${hex}`}
                className="card-publish-color-swatch"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  border: "none",
                  borderRadius: 7,
                  backgroundColor: hex,
                  cursor: disabled ? "default" : "pointer",
                  boxSizing: "border-box",
                  outline: selected ? "2px solid #ffffff" : "none",
                  boxShadow: selected ? "0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)" : "none",
                }}
                disabled={disabled}
                onClick={() => onPickBottomBarColor(hex)}
              />
            );
          })}
        </div>
        <OpacitySliderRow
          label="하단 영역 투명도"
          value01={bottomBarOpacity}
          min={0}
          max={100}
          disabled={disabled}
          ariaLabel="하단 영역 투명도"
          onChange={onBottomBarOpacityChange}
        />
      </div>

      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>가독성 그라데이션</span>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          {[
            { id: "none", label: "없음" },
            { id: "top", label: "상단" },
            { id: "left", label: "좌측" },
            { id: "top_left", label: "상단 + 좌측" },
            { id: "soft", label: "전체 약한 음영" },
          ].map((opt) => {
            const active = gradientPreset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className="v3-btn"
                aria-pressed={active}
                disabled={disabled}
                style={{ fontWeight: active ? 800 : 600 }}
                onClick={() => onGradientPresetChange(opt.id as "none" | "top" | "left" | "top_left" | "soft")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <OpacitySliderRow
          label="그라데이션 강도"
          value01={gradientOpacity}
          min={0}
          max={100}
          disabled={disabled}
          ariaLabel="그라데이션 강도"
          onChange={onGradientOpacityChange}
        />
      </div>
    </>
  );
});

const DESCRIPTION1_MAX_LINES = 1;
const DESCRIPTION2_MAX_LINES = 2;
const TITLE_MAX_LINES = 3;
const FOOTER_FIELD_MAX_LINES = 1;

function clampDescriptionToMaxLines(value: string, maxLines: number): string {
  const lines = value.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

function clampTitleToMaxLines(value: string): string {
  return clampDescriptionToMaxLines(value, TITLE_MAX_LINES);
}

export const CardPublishContentTab = memo(function CardPublishContentTab({
  leadTextColor,
  setLeadTextColor,
  titleTextColor,
  setTitleTextColor,
  descriptionTextColor,
  setDescriptionTextColor,
  footerDateTextColor,
  setFooterDateTextColor,
  footerPlaceTextColor,
  setFooterPlaceTextColor,
  textLine1,
  setTextLine1,
  title,
  setTitle,
  textLine2,
  setTextLine2,
  cardDate,
  setCardDate,
  cardPlace,
  setCardPlace,
  statusTextReadonly,
  cardTitleEffect,
  setCardTitleEffect,
  cardTitleOutlineColor,
  setCardTitleOutlineColor,
  disabled = false,
}: {
  leadTextColor: string;
  setLeadTextColor: (v: string) => void;
  titleTextColor: string;
  setTitleTextColor: (v: string) => void;
  descriptionTextColor: string;
  setDescriptionTextColor: (v: string) => void;
  footerDateTextColor: string;
  setFooterDateTextColor: (v: string) => void;
  footerPlaceTextColor: string;
  setFooterPlaceTextColor: (v: string) => void;
  textLine1: string;
  setTextLine1: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  textLine2: string;
  setTextLine2: (v: string) => void;
  cardDate: string;
  setCardDate: (v: string) => void;
  cardPlace: string;
  setCardPlace: (v: string) => void;
  statusTextReadonly: string;
  cardTitleEffect: "none" | "shadow" | "outline" | "shadow_outline";
  setCardTitleEffect: (v: "none" | "shadow" | "outline" | "shadow_outline") => void;
  cardTitleOutlineColor: "black" | "white";
  setCardTitleOutlineColor: (v: "black" | "white") => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>설명1</span>
          <div className={editorStyles.fieldHeadSwatchesPush}>
            <TextColorSwatches
              value={leadTextColor}
              onChange={setLeadTextColor}
              wrapClass={editorStyles.fieldSwatchesRow12}
              swatchClass={editorStyles.fieldSwatch}
              swatchCompactClass={editorStyles.fieldSwatchCompact}
              swatchLightClass={editorStyles.fieldSwatchLight}
              swatchSelectedClass={editorStyles.fieldSwatchSelected}
              disabled={disabled}
            />
          </div>
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight} ${editorStyles.fieldTextareaSingleLine}`}
          rows={1}
          value={textLine1}
          disabled={disabled}
          onChange={(e) => setTextLine1(clampDescriptionToMaxLines(e.target.value, DESCRIPTION1_MAX_LINES))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>제목</span>
          <div className={editorStyles.fieldHeadSwatchesPush}>
            <TextColorSwatches
              value={titleTextColor}
              onChange={setTitleTextColor}
              wrapClass={editorStyles.fieldSwatchesRow12}
              swatchClass={editorStyles.fieldSwatch}
              swatchCompactClass={editorStyles.fieldSwatchCompact}
              swatchLightClass={editorStyles.fieldSwatchLight}
              swatchSelectedClass={editorStyles.fieldSwatchSelected}
              disabled={disabled}
            />
          </div>
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight} ${editorStyles.fieldTextareaTitleSlot}`}
          rows={1}
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(clampTitleToMaxLines(e.target.value))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>설명2</span>
          <div className={editorStyles.fieldHeadSwatchesPush}>
            <TextColorSwatches
              value={descriptionTextColor}
              onChange={setDescriptionTextColor}
              wrapClass={editorStyles.fieldSwatchesRow12}
              swatchClass={editorStyles.fieldSwatch}
              swatchCompactClass={editorStyles.fieldSwatchCompact}
              swatchLightClass={editorStyles.fieldSwatchLight}
              swatchSelectedClass={editorStyles.fieldSwatchSelected}
              disabled={disabled}
            />
          </div>
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight} ${editorStyles.fieldTextareaDesc2}`}
          rows={2}
          value={textLine2}
          disabled={disabled}
          onChange={(e) => setTextLine2(clampDescriptionToMaxLines(e.target.value, DESCRIPTION2_MAX_LINES))}
          spellCheck={false}
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>날짜</span>
          <div className={editorStyles.fieldHeadSwatchesPush}>
            <TextColorSwatches
              value={footerDateTextColor}
              onChange={setFooterDateTextColor}
              wrapClass={editorStyles.fieldSwatchesRow12}
              swatchClass={editorStyles.fieldSwatch}
              swatchCompactClass={editorStyles.fieldSwatchCompact}
              swatchLightClass={editorStyles.fieldSwatchLight}
              swatchSelectedClass={editorStyles.fieldSwatchSelected}
              disabled={disabled}
            />
          </div>
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight} ${editorStyles.fieldTextareaSingleLine}`}
          rows={1}
          value={cardDate}
          disabled={disabled}
          onChange={(e) => setCardDate(clampDescriptionToMaxLines(e.target.value, FOOTER_FIELD_MAX_LINES))}
          autoComplete="off"
          spellCheck={false}
          placeholder="예: 2026-05-09 (일)"
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>장소</span>
          <div className={editorStyles.fieldHeadSwatchesPush}>
            <TextColorSwatches
              value={footerPlaceTextColor}
              onChange={setFooterPlaceTextColor}
              wrapClass={editorStyles.fieldSwatchesRow12}
              swatchClass={editorStyles.fieldSwatch}
              swatchCompactClass={editorStyles.fieldSwatchCompact}
              swatchLightClass={editorStyles.fieldSwatchLight}
              swatchSelectedClass={editorStyles.fieldSwatchSelected}
              disabled={disabled}
            />
          </div>
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight} ${editorStyles.fieldTextareaSingleLine}`}
          rows={1}
          value={cardPlace}
          disabled={disabled}
          onChange={(e) => setCardPlace(clampDescriptionToMaxLines(e.target.value, FOOTER_FIELD_MAX_LINES))}
          autoComplete="off"
          spellCheck={false}
          placeholder="예: 캐롬클럽 빌리어즈"
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>상태문구</span>
        </div>
        <div
          className={editorStyles.readonlyStatusField}
          role="note"
          aria-label="상태문구 읽기전용"
          data-outline-content-item="1"
          data-tournament-card-overlay="statusBadge"
          tabIndex={-1}
        >
          <span className={editorStyles.readonlyStatusValue}>{statusTextReadonly}</span>
          <span className={editorStyles.readonlyStatusHint}>수정 불가</span>
        </div>
      </div>

      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>제목 효과</span>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <button
            type="button"
            className="v3-btn"
            aria-pressed={cardTitleEffect === "none"}
            disabled={disabled}
            style={{ fontWeight: cardTitleEffect === "none" ? 800 : 600 }}
            onClick={() => setCardTitleEffect("none")}
          >
            없음
          </button>
          <button
            type="button"
            className="v3-btn"
            aria-pressed={cardTitleEffect === "shadow"}
            disabled={disabled}
            style={{ fontWeight: cardTitleEffect === "shadow" ? 800 : 600 }}
            onClick={() => setCardTitleEffect("shadow")}
          >
            그림자
          </button>
          <button
            type="button"
            className="v3-btn"
            aria-pressed={cardTitleEffect === "outline"}
            disabled={disabled}
            style={{ fontWeight: cardTitleEffect === "outline" ? 800 : 600 }}
            onClick={() => setCardTitleEffect("outline")}
          >
            외곽선
          </button>
          {(cardTitleEffect === "outline" || cardTitleEffect === "shadow_outline") ? (
            <div className={editorStyles.fieldSwatches} role="group" aria-label="외곽선 색상">
              <button
                type="button"
                className={`${editorStyles.fieldSwatch} ${cardTitleOutlineColor === "black" ? editorStyles.fieldSwatchSelected : ""}`}
                style={{ backgroundColor: "#111827" }}
                aria-label="외곽선 검정"
                aria-pressed={cardTitleOutlineColor === "black"}
                disabled={disabled}
                onClick={() => setCardTitleOutlineColor("black")}
              />
              <button
                type="button"
                className={`${editorStyles.fieldSwatch} ${editorStyles.fieldSwatchLight} ${cardTitleOutlineColor === "white" ? editorStyles.fieldSwatchSelected : ""}`}
                style={{ backgroundColor: "#ffffff" }}
                aria-label="외곽선 흰색"
                aria-pressed={cardTitleOutlineColor === "white"}
                disabled={disabled}
                onClick={() => setCardTitleOutlineColor("white")}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="v3-btn"
            aria-pressed={cardTitleEffect === "shadow_outline"}
            disabled={disabled}
            style={{ fontWeight: cardTitleEffect === "shadow_outline" ? 800 : 600 }}
            onClick={() => setCardTitleEffect("shadow_outline")}
          >
            그림자 + 외곽선
          </button>
        </div>
      </div>
    </>
  );
});
