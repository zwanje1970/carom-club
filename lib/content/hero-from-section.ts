import type { PageSection } from "@/types/page-section";
import type { HeroButtonSize } from "@/types/page-section";

export type HeroButtonItem = {
  label: string;
  href: string;
  size?: HeroButtonSize;
};

/** HomeHero에 넘길 Hero 데이터 형태 */
export type HeroContent = {
  heroImageUrl: string | null;
  /** 버튼 위치: 텍스트 위 / 텍스트 아래 */
  heroBtnPosition: "above" | "below";
  /** 히어로 버튼 목록 (문구, 링크, 크기) */
  heroButtons: HeroButtonItem[];
};

/**
 * 메인 비주얼용 이미지 섹션을 HomeHero용 hero 데이터로 변환.
 * copy는 버튼 위치 등에 사용 (선택).
 */
export function heroFromSection(
  section: PageSection,
  copy?: Record<string, string> | null
): HeroContent {
  const position = (copy?.["site.hero.btnPosition"] ?? "below").trim();
  const heroBtnPosition = position === "above" ? "above" : "below";
  const heroButtons: HeroButtonItem[] = (section.buttons ?? []).slice(0, 2).map((b) => ({
    label: b.name?.trim() || "버튼",
    href: b.href?.trim() || "/",
    size: b.size,
  }));
  return {
    heroImageUrl: section.imageUrl,
    heroBtnPosition,
    heroButtons,
  };
}
