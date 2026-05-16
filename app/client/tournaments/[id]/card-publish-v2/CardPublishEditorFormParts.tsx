"use client";

import { memo, type ChangeEvent, type RefObject } from "react";
import { POSTCARD_TEMPLATE_TEXT_COLOR_SWATCHES } from "../../../../../lib/postcard-template-reference";
import editorStyles from "../card-publish-editor.module.css";

const CARD_TEXT_COLOR_SWATCHES = POSTCARD_TEMPLATE_TEXT_COLOR_SWATCHES;

export const TextColorSwatches = memo(function TextColorSwatches({
  value,
  onChange,
  wrapClass,
  swatchClass,
  swatchLightClass,
  swatchSelectedClass,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  wrapClass: string;
  swatchClass: string;
  swatchLightClass: string;
  swatchSelectedClass: string;
  disabled?: boolean;
}) {
  return (
    <div className={wrapClass} role="group" aria-label="글자색">
      {CARD_TEXT_COLOR_SWATCHES.map((hex) => {
        const selected = value.trim().toLowerCase() === hex.toLowerCase();
        const isLight = hex.toLowerCase() === "#ffffff";
        return (
          <button
            key={hex}
            type="button"
            className={`${swatchClass} ${isLight ? swatchLightClass : ""} ${selected ? swatchSelectedClass : ""}`}
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
        <div className={editorStyles.rangeBlock}>
          <span className={`${editorStyles.fieldLabel} ${editorStyles.fieldLabelRow}`}>
            배경그림 투명도
            <output className={editorStyles.rangeOut}>{Math.round(imageOverlayOpacity * 100)}%</output>
          </span>
          <input
            className={editorStyles.range}
            type="range"
            min={15}
            max={100}
            step={1}
            value={Math.round(imageOverlayOpacity * 100)}
            disabled={disabled || !uploadedImage}
            aria-label="배경그림 투명도"
            onChange={(e) => onImageOverlayChange(Number(e.target.value) / 100)}
          />
        </div>
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
        <div className={editorStyles.rangeBlock}>
          <span className={`${editorStyles.fieldLabel} ${editorStyles.fieldLabelRow}`}>
            하단 영역 투명도
            <output className={editorStyles.rangeOut}>{Math.round(bottomBarOpacity * 100)}%</output>
          </span>
          <input
            className={editorStyles.range}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(bottomBarOpacity * 100)}
            disabled={disabled}
            aria-label="하단 영역 투명도"
            onChange={(e) => onBottomBarOpacityChange(Number(e.target.value) / 100)}
          />
        </div>
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
        <div className={editorStyles.rangeBlock}>
          <span className={`${editorStyles.fieldLabel} ${editorStyles.fieldLabelRow}`}>
            그라데이션 강도
            <output className={editorStyles.rangeOut}>{Math.round(gradientOpacity * 100)}%</output>
          </span>
          <input
            className={editorStyles.range}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(gradientOpacity * 100)}
            disabled={disabled}
            aria-label="그라데이션 강도"
            onChange={(e) => onGradientOpacityChange(Number(e.target.value) / 100)}
          />
        </div>
      </div>
    </>
  );
});

const DESCRIPTION_MAX_LINES = 3;

function clampDescriptionToMaxLines(value: string, maxLines: number): string {
  const lines = value.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
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
  cardTitleEffect,
  setCardTitleEffect,
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
  cardTitleEffect: "none" | "shadow" | "outline" | "shadow_outline";
  setCardTitleEffect: (v: "none" | "shadow" | "outline" | "shadow_outline") => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>제목 위 한 줄</span>
          <TextColorSwatches
            value={leadTextColor}
            onChange={setLeadTextColor}
            wrapClass={editorStyles.fieldSwatches}
            swatchClass={editorStyles.fieldSwatch}
            swatchLightClass={editorStyles.fieldSwatchLight}
            swatchSelectedClass={editorStyles.fieldSwatchSelected}
            disabled={disabled}
          />
        </div>
        <input
          className={editorStyles.fieldInput}
          type="text"
          value={textLine1}
          disabled={disabled}
          onChange={(e) => setTextLine1(e.target.value)}
          autoComplete="off"
          placeholder="비우면 표시 안 함"
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>제목 (1줄)</span>
          <TextColorSwatches
            value={titleTextColor}
            onChange={setTitleTextColor}
            wrapClass={editorStyles.fieldSwatches}
            swatchClass={editorStyles.fieldSwatch}
            swatchLightClass={editorStyles.fieldSwatchLight}
            swatchSelectedClass={editorStyles.fieldSwatchSelected}
            disabled={disabled}
          />
        </div>
        <input
          className={editorStyles.fieldInput}
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>설명 (최대 {DESCRIPTION_MAX_LINES}줄)</span>
          <TextColorSwatches
            value={descriptionTextColor}
            onChange={setDescriptionTextColor}
            wrapClass={editorStyles.fieldSwatches}
            swatchClass={editorStyles.fieldSwatch}
            swatchLightClass={editorStyles.fieldSwatchLight}
            swatchSelectedClass={editorStyles.fieldSwatchSelected}
            disabled={disabled}
          />
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight}`}
          rows={3}
          value={textLine2}
          disabled={disabled}
          onChange={(e) => setTextLine2(clampDescriptionToMaxLines(e.target.value, DESCRIPTION_MAX_LINES))}
          spellCheck={false}
          placeholder="비우면 카드에 표시하지 않음"
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>날짜</span>
          <TextColorSwatches
            value={footerDateTextColor}
            onChange={setFooterDateTextColor}
            wrapClass={editorStyles.fieldSwatches}
            swatchClass={editorStyles.fieldSwatch}
            swatchLightClass={editorStyles.fieldSwatchLight}
            swatchSelectedClass={editorStyles.fieldSwatchSelected}
            disabled={disabled}
          />
        </div>
        <input
          className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
          type="text"
          value={cardDate}
          disabled={disabled}
          onChange={(e) => setCardDate(e.target.value)}
          autoComplete="off"
          placeholder="예: 2026-05-09 (일)"
        />
      </div>

      <div className={editorStyles.field}>
        <div className={editorStyles.fieldHead}>
          <span className={editorStyles.fieldLabel}>장소</span>
          <TextColorSwatches
            value={footerPlaceTextColor}
            onChange={setFooterPlaceTextColor}
            wrapClass={editorStyles.fieldSwatches}
            swatchClass={editorStyles.fieldSwatch}
            swatchLightClass={editorStyles.fieldSwatchLight}
            swatchSelectedClass={editorStyles.fieldSwatchSelected}
            disabled={disabled}
          />
        </div>
        <input
          className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
          type="text"
          value={cardPlace}
          disabled={disabled}
          onChange={(e) => setCardPlace(e.target.value)}
          autoComplete="off"
          placeholder="예: 캐롬클럽 빌리어즈"
        />
      </div>

      <div className={editorStyles.field}>
        <span className={editorStyles.fieldLabel}>제목 효과</span>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          {[
            { id: "none", label: "없음" },
            { id: "shadow", label: "그림자" },
            { id: "outline", label: "외곽선" },
            { id: "shadow_outline", label: "그림자 + 외곽선" },
          ].map((opt) => {
            const active = cardTitleEffect === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className="v3-btn"
                aria-pressed={active}
                disabled={disabled}
                style={{ fontWeight: active ? 800 : 600 }}
                onClick={() => setCardTitleEffect(opt.id as "none" | "shadow" | "outline" | "shadow_outline")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});
