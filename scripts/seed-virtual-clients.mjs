/**
 * 로컬 dev-store(data/v3-dev-store.json)에 가상 클라이언트 10명을 넣고
 * 플랫폼 관리자가 승인한 것과 동일한 상태(APPROVED + 조직)로 맞춘다.
 *
 *   node scripts/seed-virtual-clients.mjs
 *
 * 이미 vclient01~vclient10 이 있으면 해당 계정은 건너뛴다.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVirtualVenuePreset } from "./virtual-client-venue-presets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "..", "data", "v3-dev-store.json");

function stableUserIdFromDevIdentity({ email, phone }) {
  const em = email?.trim() ? email.trim().toLowerCase() : null;
  const ph = phone?.trim() ? phone.trim() : null;
  let key;
  if (em) key = `email:${em}`;
  else if (ph) key = `phone:${ph}`;
  else return randomUUID();
  const hash = createHash("sha256").update(`v3-dev-user:\n${key}`).digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function main() {
  const raw = readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(raw);

  const platformUser = store.users?.find((u) => u.role === "PLATFORM");
  if (!platformUser?.id) {
    console.error("플랫폼 관리자 사용자를 찾을 수 없습니다.");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const added = [];

  for (let n = 1; n <= 10; n += 1) {
    const loginId = `vclient${String(n).padStart(2, "0")}`;
    const exists = store.users.some((u) => String(u.loginId).toLowerCase() === loginId);
    if (exists) {
      console.log(`건너뜀(이미 있음): ${loginId}`);
      continue;
    }

    const email = `${loginId}@virtual.demo`;
    const userId = stableUserIdFromDevIdentity({ email, phone: null });
    const phone = `0109${String(1000000 + n).slice(-7)}`;
    const password = `${loginId}pw`;
    const preset = getVirtualVenuePreset(n);
    const contactName = `데모 담당 ${n}`;

    const newOrgId = `client-org-${userId}`;
    const orgSlug = `${newOrgId}_client`;

    store.users.push({
      id: userId,
      loginId,
      nickname: loginId,
      name: preset.userDisplayName,
      email,
      phone,
      password,
      role: "CLIENT",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      linkedVenueId: orgSlug,
      pushMarketingAgreed: false,
    });

    const applicationId = randomUUID();
    store.clientApplications.push({
      id: applicationId,
      userId,
      organizationName: preset.orgName,
      contactName,
      contactPhone: phone,
      requestedClientType: "GENERAL",
      status: "APPROVED",
      rejectedReason: null,
      reviewedAt: now,
      reviewedByUserId: platformUser.id,
      createdAt: now,
      updatedAt: now,
    });

    store.clientOrganizations.push({
      clientUserId: userId,
      id: newOrgId,
      slug: orgSlug,
      name: preset.orgName,
      type: "VENUE",
      shortDescription: preset.shortDescription,
      description: preset.description,
      fullDescription: null,
      logoImageUrl: null,
      coverImageUrl: null,
      phone,
      email: null,
      website: null,
      address: preset.address,
      addressDetail: null,
      addressJibun: null,
      zipCode: null,
      latitude: preset.latitude,
      longitude: preset.longitude,
      addressNaverMapEnabled: false,
      region: preset.region,
      typeSpecificJson: preset.typeSpecificJson,
      clientType: "GENERAL",
      approvalStatus: "APPROVED",
      status: "ACTIVE",
      adminRemarks: null,
      membershipType: "NONE",
      membershipExpireAt: null,
      isPublished: preset.isPublished,
      setupCompleted: preset.setupCompleted,
      createdAt: now,
      updatedAt: now,
    });

    added.push({ loginId, password, userId, orgName: preset.orgName });
  }

  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  if (added.length === 0) {
    console.log("추가된 계정 없음. vclient01~10이 이미 존재합니다.");
    return;
  }

  console.log(`추가 완료: ${added.length}명 (플랫폼 승인 상태)`);
  for (const row of added) {
    console.log(`  ${row.loginId} / ${row.password} — ${row.orgName}`);
  }
}

main();
