/**
 * 고정 문구(SystemText) 조회.
 * 우선순위: 관리자 설정값(value) → defaultValue → 빈 문자열.
 * isEnabled=false면 빈 문자열 반환(숨김).
 */
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type SystemTextRow = {
  id: string;
  key: string;
  group: string;
  label: string;
  description: string | null;
  value: string | null;
  defaultValue: string | null;
  isEnabled: boolean;
  updatedAt: Date;
};

export async function getSystemText(key: string): Promise<string> {
  if (!isDatabaseConfigured()) return "";
  try {
    const row = await prisma.systemText.findUnique({
      where: { key },
      select: { value: true, defaultValue: true, isEnabled: true },
    });
    if (!row || !row.isEnabled) return "";
    return (row.value ?? row.defaultValue ?? "").trim();
  } catch {
    return "";
  }
}

/** 여러 키 한 번에 조회. 반환: { key: 표시문구 } (isEnabled=false면 빈 문자열) */
export async function getSystemTextMap(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!isDatabaseConfigured() || keys.length === 0) return result;
  const unique = [...new Set(keys)];
  try {
    const rows = await prisma.systemText.findMany({
      where: { key: { in: unique } },
      select: { key: true, value: true, defaultValue: true, isEnabled: true },
    });
    for (const k of unique) {
      result[k] = "";
    }
    for (const row of rows) {
      if (!row.isEnabled) continue;
      result[row.key] = (row.value ?? row.defaultValue ?? "").trim();
    }
    return result;
  } catch {
    return result;
  }
}

/** 관리자용: 전체 목록 (그룹/검색 필터) */
export async function listSystemTexts(options?: {
  group?: string;
  search?: string; // key, label, value 검색
}): Promise<SystemTextRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const where: { group?: string; OR?: { key: { contains: string; mode: "insensitive" }; label: { contains: string; mode: "insensitive" }; value: { contains: string; mode: "insensitive" } }[] } = {};
    if (options?.group) where.group = options.group;
    if (options?.search?.trim()) {
      const q = options.search.trim();
      where.OR = [
        { key: { contains: q, mode: "insensitive" } },
        { label: { contains: q, mode: "insensitive" } },
        { value: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.systemText.findMany({
      where,
      orderBy: [{ group: "asc" }, { key: "asc" }],
    });
    return rows as SystemTextRow[];
  } catch {
    return [];
  }
}
