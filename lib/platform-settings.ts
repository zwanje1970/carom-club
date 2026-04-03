/**
 * 플랫폼 요금 정책 설정 (단일 행).
 * billing_enabled=false → 모든 기능 무료 (2026년)
 * billing_enabled=true → 대회 1회 이용권/연회원 결제 적용 (2027년~)
 */

import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type PlatformSettings = {
  id: string;
  billingEnabled: boolean;
  tournamentFee: number;
  clientMembershipFee: number;
  updatedAt: Date;
};

const DEFAULTS: PlatformSettings = {
  id: "",
  billingEnabled: false,
  tournamentFee: 30000,
  clientMembershipFee: 180000,
  updatedAt: new Date(0),
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (!isDatabaseConfigured()) {
    return DEFAULTS;
  }
  try {
    const row = await prisma.platformSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      const created = await prisma.platformSettings.create({
        data: {
          billingEnabled: false,
          tournamentFee: 30000,
          clientMembershipFee: 180000,
        },
      });
      return {
        id: created.id,
        billingEnabled: created.billingEnabled,
        tournamentFee: created.tournamentFee,
        clientMembershipFee: created.clientMembershipFee,
        updatedAt: created.updatedAt,
      };
    }
    return {
      id: row.id,
      billingEnabled: row.billingEnabled,
      tournamentFee: row.tournamentFee,
      clientMembershipFee: row.clientMembershipFee,
      updatedAt: row.updatedAt,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function updatePlatformSettings(data: {
  billingEnabled?: boolean;
  tournamentFee?: number;
  clientMembershipFee?: number;
}): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  if (!current.id) {
    const created = await prisma.platformSettings.create({
      data: {
        billingEnabled: data.billingEnabled ?? false,
        tournamentFee: data.tournamentFee ?? 30000,
        clientMembershipFee: data.clientMembershipFee ?? 180000,
      },
    });
    return {
      id: created.id,
      billingEnabled: created.billingEnabled,
      tournamentFee: created.tournamentFee,
      clientMembershipFee: created.clientMembershipFee,
      updatedAt: created.updatedAt,
    };
  }
  const updated = await prisma.platformSettings.update({
    where: { id: current.id },
    data: {
      ...(data.billingEnabled !== undefined && { billingEnabled: data.billingEnabled }),
      ...(data.tournamentFee !== undefined && { tournamentFee: data.tournamentFee }),
      ...(data.clientMembershipFee !== undefined && { clientMembershipFee: data.clientMembershipFee }),
    },
  });
  return {
    id: updated.id,
    billingEnabled: updated.billingEnabled,
    tournamentFee: updated.tournamentFee,
    clientMembershipFee: updated.clientMembershipFee,
    updatedAt: updated.updatedAt,
  };
}

/** 조직이 유효한 연회원(클라이언트 당구장)인지. validUntil >= 오늘 */
export async function hasActiveClientMembership(organizationId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const now = new Date();
  const active = await prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      validUntil: { gte: now },
    },
    orderBy: { validUntil: "desc" },
  });
  return !!active;
}
