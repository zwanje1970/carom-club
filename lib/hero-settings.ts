/**
 * 메인 히어로 DB 접근. 타입·기본값은 `hero-settings-defaults`에서 re-export.
 */
export * from "./hero-settings-defaults";

import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { HeroSettings } from "./hero-settings-defaults";
import { DEFAULT_HERO_SETTINGS, parseHeroSettingsJson } from "./hero-settings-defaults";

/** DB에서 히어로 설정 조회. 항상 병합된 HeroSettings (JSON 단일 소스) */
export async function getHeroSettings(): Promise<HeroSettings> {
  if (!isDatabaseConfigured()) return { ...DEFAULT_HERO_SETTINGS };
  try {
    const row = await prisma.siteSetting.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { heroSettingsJson: true },
    });
    const parsed = parseHeroSettingsJson(row?.heroSettingsJson ?? null);
    return parsed ?? { ...DEFAULT_HERO_SETTINGS };
  } catch {
    return { ...DEFAULT_HERO_SETTINGS };
  }
}

/** 관리자: 히어로 설정 저장 */
export async function updateHeroSettings(settings: HeroSettings): Promise<HeroSettings> {
  if (!isDatabaseConfigured()) return settings;
  const existing = await prisma.siteSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!existing) {
    await prisma.siteSetting.create({
      data: {
        siteName: "CAROM.CLUB",
        primaryColor: "#d97706",
        secondaryColor: "#b91c1c",
        heroSettingsJson: JSON.stringify(settings),
      },
    });
    return settings;
  }
  await prisma.siteSetting.update({
    where: { id: existing.id },
    data: { heroSettingsJson: JSON.stringify(settings) },
  });
  return settings;
}
