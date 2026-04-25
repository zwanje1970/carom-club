import { randomUUID } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type {
  ClientApplication,
  ClientApplicationStatus,
  ClientMembershipType,
  ClientOrganizationApprovalStatus,
  ClientOrganizationStatus,
  ClientOrganizationStored,
  ClientOrganizationType,
  ClientRequestedType,
  DevUser,
} from "./platform-backing-store";
import {
  firestoreGetUserById,
  getSharedFirestoreDb,
  isFirestoreUsersBackendConfigured,
} from "./firestore-users";

export const V3_CLIENT_APPLICATIONS = "v3_client_applications";
export const V3_CLIENT_ORGANIZATIONS = "v3_client_organizations";
const V3_PLATFORM_USERS = "v3_platform_users";

export class ClientFirestoreUnavailableError extends Error {
  constructor() {
    super("CLIENT_FIRESTORE_UNAVAILABLE");
    this.name = "ClientFirestoreUnavailableError";
  }
}

class ClientApplicationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientApplicationConflictError";
  }
}

export function assertClientFirestorePersistenceConfigured(): void {
  if (!isFirestoreUsersBackendConfigured()) {
    throw new ClientFirestoreUnavailableError();
  }
}

function resolveClientOrgSlug(existing: ClientOrganizationStored | null, orgId: string): string {
  const prev = existing?.slug?.trim() ?? "";
  if (prev) return prev;
  return `${orgId}_client`;
}

function mapApplicationStatusToOrgApprovalStatus(status: ClientApplicationStatus): ClientOrganizationApprovalStatus {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

function applicationFromDoc(id: string, data: Record<string, unknown> | undefined): ClientApplication | null {
  if (!data || typeof data !== "object") return null;
  const d = data;
  const userId = typeof d.userId === "string" ? d.userId.trim() : "";
  const organizationName = typeof d.organizationName === "string" ? d.organizationName : "";
  const contactName = typeof d.contactName === "string" ? d.contactName : "";
  const contactPhone = typeof d.contactPhone === "string" ? d.contactPhone : "";
  const requestedClientType: ClientRequestedType =
    d.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL";
  const status: ClientApplicationStatus =
    d.status === "PENDING" || d.status === "APPROVED" || d.status === "REJECTED" ? d.status : "PENDING";
  const rejectedReason =
    d.rejectedReason === null || typeof d.rejectedReason === "string" ? (d.rejectedReason as string | null) : null;
  const reviewedAt =
    d.reviewedAt === null || typeof d.reviewedAt === "string" ? (d.reviewedAt as string | null) : null;
  const reviewedByUserId =
    d.reviewedByUserId === null || typeof d.reviewedByUserId === "string"
      ? (d.reviewedByUserId as string | null)
      : null;
  const createdAt = typeof d.createdAt === "string" ? d.createdAt : "";
  const updatedAt = typeof d.updatedAt === "string" ? d.updatedAt : "";
  if (!userId || !createdAt || !updatedAt) return null;
  return {
    id,
    userId,
    organizationName,
    contactName,
    contactPhone,
    requestedClientType,
    status,
    rejectedReason,
    reviewedAt,
    reviewedByUserId,
    createdAt,
    updatedAt,
  };
}

function applicationToFirestore(a: ClientApplication): Record<string, unknown> {
  return {
    id: a.id,
    userId: a.userId,
    organizationName: a.organizationName,
    contactName: a.contactName,
    contactPhone: a.contactPhone,
    requestedClientType: a.requestedClientType,
    status: a.status,
    rejectedReason: a.rejectedReason,
    reviewedAt: a.reviewedAt,
    reviewedByUserId: a.reviewedByUserId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function organizationFromDoc(id: string, data: Record<string, unknown> | undefined): ClientOrganizationStored | null {
  if (!data || typeof data !== "object") return null;
  const r = data;
  const clientUserId = typeof r.clientUserId === "string" ? r.clientUserId.trim() : "";
  if (!clientUserId) return null;
  const now = new Date().toISOString();
  return {
    clientUserId,
    id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : id,
    slug: typeof r.slug === "string" ? r.slug : `${id}_client`,
    name: typeof r.name === "string" ? r.name : "",
    type: typeof r.type === "string" ? r.type : "VENUE",
    shortDescription: typeof r.shortDescription === "string" ? r.shortDescription : null,
    description: typeof r.description === "string" ? r.description : null,
    fullDescription: typeof r.fullDescription === "string" ? r.fullDescription : null,
    logoImageUrl: typeof r.logoImageUrl === "string" ? r.logoImageUrl : null,
    coverImageUrl: typeof r.coverImageUrl === "string" ? r.coverImageUrl : null,
    phone: typeof r.phone === "string" ? r.phone : null,
    email: typeof r.email === "string" ? r.email : null,
    website: typeof r.website === "string" ? r.website : null,
    address: typeof r.address === "string" ? r.address : null,
    addressDetail: typeof r.addressDetail === "string" ? r.addressDetail : null,
    addressJibun: typeof r.addressJibun === "string" ? r.addressJibun : null,
    zipCode: typeof r.zipCode === "string" ? r.zipCode : null,
    latitude: typeof r.latitude === "number" ? r.latitude : null,
    longitude: typeof r.longitude === "number" ? r.longitude : null,
    addressNaverMapEnabled:
      typeof r.addressNaverMapEnabled === "boolean"
        ? r.addressNaverMapEnabled
        : r.addressNaverMapEnabled === null
          ? null
          : false,
    region: typeof r.region === "string" ? r.region : null,
    typeSpecificJson: typeof r.typeSpecificJson === "string" ? r.typeSpecificJson : null,
    clientType: r.clientType === "REGISTERED" ? "REGISTERED" : "GENERAL",
    approvalStatus:
      r.approvalStatus === "APPROVED" || r.approvalStatus === "REJECTED" || r.approvalStatus === "PENDING"
        ? r.approvalStatus
        : "PENDING",
    status:
      r.status === "ACTIVE" || r.status === "SUSPENDED" || r.status === "EXPELLED" ? r.status : "ACTIVE",
    adminRemarks: typeof r.adminRemarks === "string" ? r.adminRemarks : null,
    membershipType: r.membershipType === "ANNUAL" ? "ANNUAL" : "NONE",
    membershipExpireAt:
      r.membershipExpireAt === null || typeof r.membershipExpireAt === "string" ? (r.membershipExpireAt as string | null) : null,
    isPublished: typeof r.isPublished === "boolean" ? r.isPublished : false,
    setupCompleted: typeof r.setupCompleted === "boolean" ? r.setupCompleted : false,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : now,
  };
}

function organizationToFirestore(o: ClientOrganizationStored): Record<string, unknown> {
  return { ...o };
}

async function queryLatestApplicationForUser(db: Firestore, userId: string): Promise<ClientApplication | null> {
  const uid = userId.trim();
  if (!uid) return null;
  const snap = await db.collection(V3_CLIENT_APPLICATIONS).where("userId", "==", uid).limit(48).get();
  const rows: ClientApplication[] = [];
  for (const doc of snap.docs) {
    const row = applicationFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows[0]!;
}

export async function getLatestClientApplicationByUserIdFirestore(userId: string): Promise<ClientApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  return queryLatestApplicationForUser(db, userId);
}

export async function getClientStatusByUserIdFirestore(userId: string): Promise<ClientApplicationStatus | null> {
  const latest = await getLatestClientApplicationByUserIdFirestore(userId);
  return latest?.status ?? null;
}

export async function listClientApplicationsFirestore(): Promise<ClientApplication[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const snap = await db.collection(V3_CLIENT_APPLICATIONS).orderBy("createdAt", "desc").limit(2000).get();
  const out: ClientApplication[] = [];
  for (const doc of snap.docs) {
    const row = applicationFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

export async function getApplicationSummariesFirestore(): Promise<
  Array<{
    application: ClientApplication;
    user: DevUser | null;
  }>
> {
  assertClientFirestorePersistenceConfigured();
  const apps = await listClientApplicationsFirestore();
  const out: Array<{ application: ClientApplication; user: DevUser | null }> = [];
  for (const application of apps) {
    const user = await firestoreGetUserById(application.userId);
    out.push({ application, user });
  }
  return out;
}

export async function createClientApplicationFirestore(params: {
  userId: string;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  requestedClientType?: ClientRequestedType;
}): Promise<{ ok: true; application: ClientApplication } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const organizationName = params.organizationName.trim();
  const contactName = params.contactName.trim();
  const contactPhone = params.contactPhone.trim();

  if (!organizationName) return { ok: false, error: "조직명을 입력해 주세요." };
  if (!contactName) return { ok: false, error: "담당자명을 입력해 주세요." };
  if (!contactPhone) return { ok: false, error: "담당자 연락처를 입력해 주세요." };

  const preUser = await firestoreGetUserById(params.userId.trim());
  if (!preUser) return { ok: false, error: "사용자를 찾을 수 없습니다." };

  const canonicalUserId = params.userId.trim();
  const db = getSharedFirestoreDb();

  try {
    const application = await db.runTransaction(async (tx) => {
      const qSnap = await tx.get(db.collection(V3_CLIENT_APPLICATIONS).where("userId", "==", canonicalUserId).limit(48));
      const apps: ClientApplication[] = [];
      for (const d of qSnap.docs) {
        const row = applicationFromDoc(d.id, d.data() as Record<string, unknown>);
        if (row) apps.push(row);
      }
      apps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const existing = apps[0];

      if (existing?.status === "PENDING") {
        throw new ClientApplicationConflictError("이미 승인 대기 중인 신청이 있습니다.");
      }
      if (existing?.status === "APPROVED") {
        throw new ClientApplicationConflictError("이미 승인 완료된 클라이언트 계정입니다.");
      }

      const now = new Date().toISOString();
      const requestedClientType: ClientRequestedType =
        params.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL";
      const id = randomUUID();
      const nextApplication: ClientApplication = {
        id,
        userId: canonicalUserId,
        organizationName,
        contactName,
        contactPhone,
        requestedClientType,
        status: "PENDING",
        rejectedReason: null,
        reviewedAt: null,
        reviewedByUserId: null,
        createdAt: now,
        updatedAt: now,
      };

      const userRef = db.collection(V3_PLATFORM_USERS).doc(canonicalUserId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new ClientApplicationConflictError("사용자를 찾을 수 없습니다.");
      }

      tx.set(db.collection(V3_CLIENT_APPLICATIONS).doc(id), applicationToFirestore(nextApplication));
      tx.update(userRef, {
        role: "CLIENT",
        updatedAt: now,
      });
      return nextApplication;
    });
    return { ok: true, application };
  } catch (e) {
    if (e instanceof ClientApplicationConflictError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function updateClientApplicationStatusFirestore(
  applicationId: string,
  params: {
    status: ClientApplicationStatus;
    reviewedByUserId: string;
    rejectedReason?: string | null;
  }
): Promise<ClientApplication | null> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const aid = applicationId.trim();
  if (!aid) return null;

  return db.runTransaction(async (tx) => {
    const appRef = db.collection(V3_CLIENT_APPLICATIONS).doc(aid);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) return null;
    const prev = applicationFromDoc(appSnap.id, appSnap.data() as Record<string, unknown>);
    if (!prev) return null;

    const now = new Date().toISOString();
    const rejectedReason =
      params.status === "REJECTED"
        ? params.rejectedReason === undefined
          ? prev.rejectedReason
          : params.rejectedReason != null && String(params.rejectedReason).trim() !== ""
            ? String(params.rejectedReason).trim()
            : null
        : null;

    const updated: ClientApplication = {
      ...prev,
      status: params.status,
      reviewedAt: now,
      reviewedByUserId: params.reviewedByUserId.trim() || null,
      rejectedReason,
      updatedAt: now,
    };

    const canonicalUserId = prev.userId;
    const requestedType: ClientRequestedType =
      prev.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL";
    const mappedApproval = mapApplicationStatusToOrgApprovalStatus(params.status);
    const orgId = `client-org-${canonicalUserId}`;
    const orgRef = db.collection(V3_CLIENT_ORGANIZATIONS).doc(orgId);
    const orgSnap = await tx.get(orgRef);
    const existingOrg = orgSnap.exists ? organizationFromDoc(orgSnap.id, orgSnap.data() as Record<string, unknown>) : null;

    const userRef = db.collection(V3_PLATFORM_USERS).doc(canonicalUserId);
    const userSnap = await tx.get(userRef);

    let nextOrg: ClientOrganizationStored;
    if (existingOrg) {
      nextOrg = {
        ...existingOrg,
        name: existingOrg.name?.trim() ? existingOrg.name : prev.organizationName,
        slug: resolveClientOrgSlug(existingOrg, existingOrg.id),
        phone: existingOrg.phone ?? prev.contactPhone,
        clientType: requestedType === "REGISTERED" ? "REGISTERED" : "GENERAL",
        approvalStatus: mappedApproval,
        membershipType: requestedType === "REGISTERED" ? "ANNUAL" : "NONE",
        membershipExpireAt: requestedType === "REGISTERED" ? existingOrg.membershipExpireAt : null,
        updatedAt: now,
      };
      if (params.status === "APPROVED" && nextOrg.status !== "SUSPENDED" && nextOrg.status !== "EXPELLED") {
        nextOrg = { ...nextOrg, status: "ACTIVE" };
      }
    } else {
      nextOrg = {
        clientUserId: canonicalUserId,
        id: orgId,
        slug: `${orgId}_client`,
        name: prev.organizationName,
        type: "VENUE",
        shortDescription: null,
        description: null,
        fullDescription: null,
        logoImageUrl: null,
        coverImageUrl: null,
        phone: prev.contactPhone,
        email: null,
        website: null,
        address: null,
        addressDetail: null,
        addressJibun: null,
        zipCode: null,
        latitude: null,
        longitude: null,
        addressNaverMapEnabled: false,
        region: null,
        typeSpecificJson: null,
        clientType: requestedType === "REGISTERED" ? "REGISTERED" : "GENERAL",
        approvalStatus: mappedApproval,
        status: "ACTIVE",
        adminRemarks: null,
        membershipType: requestedType === "REGISTERED" ? "ANNUAL" : "NONE",
        membershipExpireAt: null,
        isPublished: false,
        setupCompleted: false,
        createdAt: now,
        updatedAt: now,
      };
    }

    tx.set(appRef, applicationToFirestore(updated));
    tx.set(orgRef, organizationToFirestore(nextOrg));
    if (userSnap.exists) {
      tx.update(userRef, { role: "CLIENT", updatedAt: now });
    }

    return updated;
  });
}

export async function getClientOrganizationByUserIdFirestore(userId: string): Promise<ClientOrganizationStored | null> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const uid = userId.trim();
  if (!uid) return null;
  const orgId = `client-org-${uid}`;
  const snap = await db.collection(V3_CLIENT_ORGANIZATIONS).doc(orgId).get();
  if (snap.exists) {
    const o = organizationFromDoc(snap.id, snap.data() as Record<string, unknown>);
    if (o) return o;
  }
  const q = await db.collection(V3_CLIENT_ORGANIZATIONS).where("clientUserId", "==", uid).limit(1).get();
  const d = q.docs[0];
  return d ? organizationFromDoc(d.id, d.data() as Record<string, unknown>) : null;
}

export async function getClientOrganizationByIdForPlatformFirestore(orgId: string): Promise<ClientOrganizationStored | null> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const id = orgId.trim();
  if (!id) return null;
  const snap = await db.collection(V3_CLIENT_ORGANIZATIONS).doc(id).get();
  if (!snap.exists) return null;
  return organizationFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function listApprovedClientOrganizationsFirestore(params?: {
  status?: ClientOrganizationStatus | "all";
  clientType?: ClientOrganizationType | "all";
}): Promise<ClientOrganizationStored[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const status = params?.status ?? "all";
  const clientType = params?.clientType ?? "all";
  const snap = await db.collection(V3_CLIENT_ORGANIZATIONS).where("approvalStatus", "==", "APPROVED").limit(2000).get();
  const rows: ClientOrganizationStored[] = [];
  for (const doc of snap.docs) {
    const row = organizationFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (!row) continue;
    if (status !== "all" && row.status !== status) continue;
    if (clientType !== "all" && row.clientType !== clientType) continue;
    rows.push(row);
  }
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows;
}

export async function upsertClientOrganizationForUserFirestore(
  userId: string,
  params: {
    name: string;
    shortDescription: string | null;
    description: string | null;
    fullDescription: string | null;
    logoImageUrl: string | null;
    coverImageUrl: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    addressDetail: string | null;
    addressJibun: string | null;
    zipCode: string | null;
    latitude: number | null;
    longitude: number | null;
    addressNaverMapEnabled: boolean;
    region: string | null;
    typeSpecificJson: string | null;
    isPublished: boolean;
    setupCompleted: boolean;
  }
): Promise<{ ok: true; org: ClientOrganizationStored } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const canonical = userId.trim();
  if (!canonical) return { ok: false, error: "잘못된 요청입니다." };

  return db.runTransaction(async (tx) => {
    const orgIdDefault = `client-org-${canonical}`;
    const orgRef = db.collection(V3_CLIENT_ORGANIZATIONS).doc(orgIdDefault);
    const orgSnap = await tx.get(orgRef);
    let existing: ClientOrganizationStored | null = orgSnap.exists
      ? organizationFromDoc(orgSnap.id, orgSnap.data() as Record<string, unknown>)
      : null;
    if (!existing) {
      const q = await tx.get(db.collection(V3_CLIENT_ORGANIZATIONS).where("clientUserId", "==", canonical).limit(4));
      for (const d of q.docs) {
        const row = organizationFromDoc(d.id, d.data() as Record<string, unknown>);
        if (row) {
          existing = row;
          break;
        }
      }
    }

    const now = new Date().toISOString();
    const orgId = existing?.id ?? orgIdDefault;
    const orgRefFinal = db.collection(V3_CLIENT_ORGANIZATIONS).doc(orgId);
    const slugResolved = resolveClientOrgSlug(existing, orgId);

    const dupSnap = await tx.get(
      db.collection(V3_CLIENT_ORGANIZATIONS).where("slug", "==", slugResolved).limit(8)
    );
    for (const d of dupSnap.docs) {
      const o = organizationFromDoc(d.id, d.data() as Record<string, unknown>);
      if (o && o.clientUserId !== canonical) {
        throw new ClientApplicationConflictError("조직 식별자 충돌이 있습니다. 관리자에게 문의해 주세요.");
      }
    }

    const nextType = existing?.type?.trim() ? existing.type.trim() : "VENUE";
    const next: ClientOrganizationStored = {
      clientUserId: canonical,
      id: orgId,
      slug: slugResolved,
      name: params.name.trim(),
      type: nextType,
      shortDescription: params.shortDescription,
      description: params.description,
      fullDescription: params.fullDescription,
      logoImageUrl: params.logoImageUrl,
      coverImageUrl: params.coverImageUrl,
      phone: params.phone,
      email: params.email,
      website: params.website,
      address: params.address,
      addressDetail: params.addressDetail,
      addressJibun: params.addressJibun,
      zipCode: params.zipCode,
      latitude: params.latitude,
      longitude: params.longitude,
      addressNaverMapEnabled: params.addressNaverMapEnabled,
      region: params.region,
      typeSpecificJson: params.typeSpecificJson,
      clientType: existing?.clientType === "REGISTERED" ? "REGISTERED" : "GENERAL",
      approvalStatus: existing?.approvalStatus ?? "APPROVED",
      status: existing?.status ?? "ACTIVE",
      adminRemarks: existing?.adminRemarks ?? null,
      membershipType: existing?.membershipType === "ANNUAL" ? "ANNUAL" : "NONE",
      membershipExpireAt: existing?.membershipExpireAt ?? null,
      isPublished: params.isPublished,
      setupCompleted: params.setupCompleted,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    tx.set(orgRefFinal, organizationToFirestore(next));
    return { ok: true as const, org: next };
  }).catch((e) => {
    if (e instanceof ClientApplicationConflictError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  });
}

export async function patchClientOrganizationForPlatformFirestore(
  orgId: string,
  params: {
    status?: ClientOrganizationStatus;
    clientType?: ClientOrganizationType;
    approvalStatus?: ClientOrganizationApprovalStatus;
    membershipType?: ClientMembershipType;
    membershipExpireAt?: string | null;
    adminRemarks?: string | null;
  }
): Promise<ClientOrganizationStored | null> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const id = orgId.trim();
  if (!id) return null;
  return db.runTransaction(async (tx) => {
    const ref = db.collection(V3_CLIENT_ORGANIZATIONS).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const current = organizationFromDoc(snap.id, snap.data() as Record<string, unknown>);
    if (!current) return null;
    const nextMembershipType = params.membershipType ?? current.membershipType;
    const nextMembershipExpireAt =
      params.membershipExpireAt !== undefined
        ? params.membershipExpireAt && params.membershipExpireAt.trim()
          ? params.membershipExpireAt.trim()
          : null
        : current.membershipExpireAt;
    const now = new Date().toISOString();
    const next: ClientOrganizationStored = {
      ...current,
      status: params.status ?? current.status,
      clientType: params.clientType ?? current.clientType,
      approvalStatus: params.approvalStatus ?? current.approvalStatus,
      membershipType: nextMembershipType,
      membershipExpireAt: nextMembershipType === "ANNUAL" ? nextMembershipExpireAt : null,
      adminRemarks:
        params.adminRemarks !== undefined
          ? params.adminRemarks && params.adminRemarks.trim()
            ? params.adminRemarks.trim()
            : null
          : current.adminRemarks,
      updatedAt: now,
    };
    tx.set(ref, organizationToFirestore(next));
    return next;
  });
}
