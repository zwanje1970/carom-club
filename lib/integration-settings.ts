import { prisma } from "@/lib/db";

/**
 * 연동 설정(API 키 등). DB에 저장된 값을 우선 사용하고, 없으면 환경변수를 사용합니다.
 * 키 값은 API 응답으로 내려보내지 않고, 서버에서만 읽어 사용하세요.
 */

export async function getIntegrationSettings(): Promise<{
  naverMapClientId: string | null;
}> {
  const row = await prisma.integrationSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return {
    naverMapClientId: row?.naverMapClientId ?? null,
  };
}

/** 네이버 지도 클라이언트 ID. DB 우선, 없으면 env. 서버에서만 호출하세요. */
export async function getNaverMapClientId(): Promise<string | null> {
  const settings = await getIntegrationSettings();
  if (settings.naverMapClientId?.trim()) return settings.naverMapClientId.trim();
  const env = process.env.NAVER_MAP_CLIENT_ID;
  if (typeof env === "string" && env.trim()) return env.trim();
  return null;
}

/** 설정 여부만 (키 값 노출 없음). */
export async function isNaverMapConfigured(): Promise<boolean> {
  const id = await getNaverMapClientId();
  return id != null && id.length > 0;
}

export async function updateIntegrationSettings(data: {
  naverMapClientId?: string | null;
}): Promise<void> {
  const existing = await prisma.integrationSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  const value = data.naverMapClientId?.trim() || null;
  if (!existing) {
    await prisma.integrationSetting.create({
      data: { naverMapClientId: value },
    });
    return;
  }
  await prisma.integrationSetting.update({
    where: { id: existing.id },
    data: { naverMapClientId: value },
  });
}
