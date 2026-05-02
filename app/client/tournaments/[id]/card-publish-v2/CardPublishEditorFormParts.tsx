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
}: {
  value: string;
  onChange: (next: string) => void;
  wrapClass: string;
  swatchClass: string;
  swatchLightClass: string;
  swatchSelectedClass: string;
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
  uploading,
  uploadedImage,
  imageOverlayOpacity,
  onImageOverlayChange,
}: {
  mediaBackground: string;
  onPickPaletteColor: (hex: string) => void;
  bgFileInputRef: RefObject<HTMLInputElement | null>;
  onBackgroundFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearBackgroundFileSelection: () => void;
  uploading: boolean;
  uploadedImage: { w320Url: string } | null;
  imageOverlayOpacity: number;
  onImageOverlayChange: (opacity01: number) => void;
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
                  cursor: "pointer",
                  boxSizing: "border-box",
                  outline: selected ? "2px solid #ffffff" : "none",
                  boxShadow: selected ? "0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)" : "none",
                }}
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
            onChange={onBackgroundFileChange}
          />
          <button
            type="button"
            className={editorStyles.clearBtn}
            style={{ marginTop: 0 }}
            onClick={onClearBackgroundFileSelection}
          >
            선택해제
          </button>
        </div>
        {uploading ? (
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.78rem" }}>
            업로드 중…
          </p>
        ) : null}
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
            disabled={!uploadedImage}
            aria-label="배경그림 투명도"
            onChange={(e) => onImageOverlayChange(Number(e.target.value) / 100)}
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
  cardTextShadowEnabled,
  setCardTextShadowEnabled,
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
  cardTextShadowEnabled: boolean;
  setCardTextShadowEnabled: (v: boolean) => void;
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
          />
        </div>
        <input
          className={editorStyles.fieldInput}
          type="text"
          value={textLine1}
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
          />
        </div>
        <input
          className={editorStyles.fieldInput}
          type="text"
          value={title}
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
          />
        </div>
        <textarea
          className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight}`}
          rows={3}
          value={textLine2}
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
          />
        </div>
        <input
          className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
          type="text"
          value={cardDate}
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
          />
        </div>
        <input
          className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
          type="text"
          value={cardPlace}
          onChange={(e) => setCardPlace(e.target.value)}
          autoComplete="off"
          placeholder="예: 캐롬클럽 빌리어즈"
        />
      </div>

      <label className={editorStyles.fieldCheck}>
        <input
          type="checkbox"
          checked={cardTextShadowEnabled}
          onChange={(e) => setCardTextShadowEnabled(e.target.checked)}
        />
        <span>전체 글자에 그림자 넣기</span>
      </label>
    </>
  );
});
