import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type AdminLogPayload = {
  adminId: string;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
};

export async function createAdminLog(payload: AdminLogPayload): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await prisma.adminLog.create({
      data: {
        adminId: payload.adminId,
        actionType: payload.actionType,
        targetType: payload.targetType,
        targetId: payload.targetId ?? null,
        beforeValue: payload.beforeValue ?? null,
        afterValue: payload.afterValue ?? null,
      },
    });
  } catch (e) {
    console.error("[admin-log] create error:", e);
  }
}
