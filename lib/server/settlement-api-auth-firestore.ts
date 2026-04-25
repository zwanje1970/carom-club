/**
 * 정산 API 라우트용: 사용자·클라이언트 게이트만 Firestore/KV 경로.
 */
import type { AuthRole } from "../auth/roles";
import {
  getClientOrganizationByUserIdFirestore,
  getClientStatusByUserIdFirestore,
} from "./firestore-client-applications";
import { firestoreGetUserById, isFirestoreUsersBackendConfigured } from "./firestore-users";
import { readPlatformOperationSettingsRawFromFirestoreKv } from "./platform-operation-settings";

type ClientDashboardPolicySnapshot = {
  orgStatus: string | null;
  membershipType: "ANNUAL" | "NONE";
  membershipState: "NONE" | "ACTIVE" | "EXPIRED";
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
};

function membershipStateOfOrg(org: { membershipType?: string; membershipExpireAt?: string | null }): "NONE" | "ACTIVE" | "EXPIRED" {
  if (org.membershipType !== "ANNUAL") return "NONE";
  if (!org.membershipExpireAt) return "ACTIVE";
  return new Date(org.membershipExpireAt).getTime() >= Date.now() ? "ACTIVE" : "EXPIRED";
}

function normalizePlatformOperationSettingsForGate(input: unknown): {
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
} {
  const fallback = { annualMembershipVisible: false, annualMembershipEnforced: false };
  if (!input || typeof input !== "object") return fallback;
  const row = input as { annualMembershipVisible?: unknown; annualMembershipEnforced?: unknown };
  const annualMembershipEnforced =
    typeof row.annualMembershipEnforced === "boolean" ? row.annualMembershipEnforced : fallback.annualMembershipEnforced;
  const annualMembershipVisibleRaw =
    typeof row.annualMembershipVisible === "boolean" ? row.annualMembershipVisible : fallback.annualMembershipVisible;
  const annualMembershipVisible = annualMembershipEnforced ? true : annualMembershipVisibleRaw;
  return { annualMembershipVisible, annualMembershipEnforced };
}

async function readPlatformOperationSettingsKvOnly(): Promise<{
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
}> {
  if (!isFirestoreUsersBackendConfigured()) {
    return { annualMembershipVisible: false, annualMembershipEnforced: false };
  }
  try {
    const raw = await readPlatformOperationSettingsRawFromFirestoreKv();
    return normalizePlatformOperationSettingsForGate(raw ?? undefined);
  } catch {
    return { annualMembershipVisible: false, annualMembershipEnforced: false };
  }
}

async function getClientDashboardPolicyForSettlementApi(userId: string): Promise<ClientDashboardPolicySnapshot> {
  const org = await getClientOrganizationByUserIdFirestore(userId.trim());
  const settings = await readPlatformOperationSettingsKvOnly();
  return {
    orgStatus: org?.status ?? null,
    membershipType: org?.membershipType === "ANNUAL" ? "ANNUAL" : "NONE",
    membershipState: org ? membershipStateOfOrg(org) : "NONE",
    annualMembershipVisible: settings.annualMembershipVisible,
    annualMembershipEnforced: settings.annualMembershipEnforced,
  };
}

export async function settlementApiGetSessionUser(userId: string): Promise<{
  id: string;
  role: AuthRole;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
} | null> {
  if (!isFirestoreUsersBackendConfigured()) return null;
  const u = await firestoreGetUserById(userId);
  if (!u) return null;
  const status = u.status === "SUSPENDED" || u.status === "DELETED" ? u.status : "ACTIVE";
  return { id: u.id, role: u.role, status };
}

export async function settlementApiCheckClientFeatureAccess(params: {
  userId: string;
  feature: "SETTLEMENT" | "BRACKET";
}): Promise<
  | { ok: true; policy: ClientDashboardPolicySnapshot }
  | { ok: false; error: string; policy: ClientDashboardPolicySnapshot }
> {
  void params.feature;
  const currentUser = await settlementApiGetSessionUser(params.userId);
  const clientStatus = await getClientStatusByUserIdFirestore(params.userId);
  const policy = await getClientDashboardPolicyForSettlementApi(params.userId);

  if (!currentUser || (currentUser.role !== "CLIENT" && currentUser.role !== "PLATFORM")) {
    return { ok: false, error: "클라이언트 권한이 없습니다.", policy };
  }
  if (currentUser.status === "SUSPENDED" || currentUser.status === "DELETED") {
    return { ok: false, error: "현재 이용이 제한된 상태입니다. 관리자에게 문의하세요", policy };
  }
  if (clientStatus !== "APPROVED") {
    return { ok: false, error: "승인 완료된 클라이언트만 접근할 수 있습니다.", policy };
  }
  if (policy.orgStatus === "SUSPENDED" || policy.orgStatus === "EXPELLED") {
    return { ok: false, error: "현재 이용이 제한된 상태입니다. 관리자에게 문의하세요", policy };
  }
  if (policy.annualMembershipEnforced && policy.membershipState !== "ACTIVE") {
    return { ok: false, error: "이 기능은 연회원 전용입니다. 연회원 가입 후 이용 가능합니다", policy };
  }
  return { ok: true, policy };
}
