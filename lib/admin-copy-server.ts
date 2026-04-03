import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { AdminCopyKey, DEFAULT_ADMIN_COPY } from "@/lib/admin-copy";

const COPY_KEYS = Object.keys(DEFAULT_ADMIN_COPY) as AdminCopyKey[];

async function getAdminCopyUncached(keys?: readonly string[]): Promise<Record<string, string>> {
  const base = { ...DEFAULT_ADMIN_COPY };
  if (!isDatabaseConfigured()) return base;
  try {
    const requestedKeys = keys
      ? keys.filter((key): key is AdminCopyKey => COPY_KEYS.includes(key as AdminCopyKey))
      : COPY_KEYS;
    if (requestedKeys.length === 0) return base;
    const rows = await prisma.adminCopy.findMany({
      where: { key: { in: requestedKeys } },
    });
    for (const row of rows) {
      if (COPY_KEYS.includes(row.key as AdminCopyKey)) {
        base[row.key] = row.value;
      }
    }
    return base;
  } catch {
    return base;
  }
}

const getAdminCopyCached = cache(
  async (cacheKey: string, keys?: readonly string[]) => getAdminCopyUncached(keys)
);

/** DB에서 커스텀 값 조회 후 기본값과 병합 */
export async function getAdminCopy(keys?: readonly string[]): Promise<Record<string, string>> {
  const requestedKeys = keys && keys.length > 0 ? [...keys].sort() : undefined;
  const cacheKey = requestedKeys ? requestedKeys.join("|") : "all";
  return getAdminCopyCached(cacheKey, requestedKeys);
}

/** 여러 키-값 저장 (Prisma upsert로 SQLite/PostgreSQL 공통) */
export async function updateAdminCopy(updates: Record<string, string>): Promise<void> {
  if (!isDatabaseConfigured()) return;
  for (const key of Object.keys(updates)) {
    if (!COPY_KEYS.includes(key as AdminCopyKey)) continue;
    const value = updates[key]?.trim() ?? "";
    const finalValue = value || (DEFAULT_ADMIN_COPY[key as AdminCopyKey] ?? key);
    try {
      await prisma.adminCopy.upsert({
        where: { key },
        create: { key, value: finalValue },
        update: { value: finalValue },
      });
    } catch (e) {
      console.error("[admin-copy] upsert error for key:", key, e);
      throw e;
    }
  }
}
