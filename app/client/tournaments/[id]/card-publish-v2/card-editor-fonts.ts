/**
 * 게시카드 편집기(v2) 전용 Pretendard 정적 OTF — 라우트 진입 시에만 FontFace 로드.
 * 전역 layout.css @font-face 없음. 패밀리명은 사이트 본문과 분리.
 *
 * `public/card-fonts/`:
 * - Pretendard-Light.otf     → 본문 기본 (CSS 300)
 * - Pretendard-Medium.otf    → 외곽선 ON 본문 (CSS 500)
 * - Pretendard-Bold.otf      → 제목 기본 (CSS 700)
 * - Pretendard-ExtraBold.otf → 외곽선 ON 제목 (CSS 800)
 *
 * 1차 URL 로드 실패 시에만 `Pretendard-Regular.otf` 로 폴백 (FontFace·SVG path 공통).
 */

export const CAROM_CARD_EDITOR_FONT_FAMILY = "CaromCardEditorPretendard";

/** 미리보기·캡처 DOM `font-family` 값 */
export const CAROM_CARD_EDITOR_FONT_STACK = `${CAROM_CARD_EDITOR_FONT_FAMILY}, ui-sans-serif, system-ui, sans-serif`;

/** FontFace descriptor·SVG 버킷과 동일한 CSS 숫자 굵기 */
export type CardEditorNumericWeight = 300 | 500 | 700 | 800;

const WEIGHT_TO_OTF: Record<CardEditorNumericWeight, string> = {
  300: "/card-fonts/Pretendard-Light.otf",
  500: "/card-fonts/Pretendard-Medium.otf",
  700: "/card-fonts/Pretendard-Bold.otf",
  800: "/card-fonts/Pretendard-ExtraBold.otf",
};

const FALLBACK_OTF = "/card-fonts/Pretendard-Regular.otf";

let fontsLoadPromise: Promise<boolean> | null = null;

/**
 * `getComputedStyle(...).fontWeight` 등 → Light/Medium/Bold/ExtraBold 버킷 하나.
 * 편집기에서 쓰는 값은 300 | 500 | 700 | 800 만 온다고 가정하고, 그 외 숫자는 가장 가까운 버킷으로 수렴.
 */
export function resolveCardEditorCssWeight(raw: string | number): CardEditorNumericWeight {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return 500;
  if (n >= 750) return 800;
  if (n >= 600) return 700;
  if (n >= 400) return 500;
  return 300;
}

async function tryLoadFontFace(weight: CardEditorNumericWeight, url: string): Promise<boolean> {
  const spec = `url("${url}") format("opentype")`;
  const face = new FontFace(CAROM_CARD_EDITOR_FONT_FAMILY, spec, {
    weight: String(weight),
    style: "normal",
    display: "swap",
  });
  try {
    const loaded = await face.load();
    document.fonts.add(loaded);
    return true;
  } catch {
    return false;
  }
}

/**
 * 편집기 라우트에서 한 번 호출. 4 weight — 각각 primary 실패 시에만 Regular 폴백.
 * @returns 하나 이상 로드되면 true
 */
export function ensureCardEditorFontsLoaded(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (fontsLoadPromise) return fontsLoadPromise;

  fontsLoadPromise = (async () => {
    const order: CardEditorNumericWeight[] = [300, 500, 700, 800];
    let anyOk = false;
    for (const w of order) {
      const ok = await tryLoadFontFace(w, WEIGHT_TO_OTF[w]);
      if (ok) {
        anyOk = true;
        continue;
      }
      const fb = await tryLoadFontFace(w, FALLBACK_OTF);
      if (fb) anyOk = true;
    }
    return anyOk;
  })();

  return fontsLoadPromise;
}

/** SVG path용 — weight 버킷별 OTF URL (폴백은 preview-text-outline-path 에서 처리) */
export function cardEditorOutlineFontUrl(weight: CardEditorNumericWeight): string {
  return WEIGHT_TO_OTF[weight];
}

export function cardEditorOutlineFontFallbackUrl(): string {
  return FALLBACK_OTF;
}
