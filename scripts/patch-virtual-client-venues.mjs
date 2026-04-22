/**
 * 이미 존재하는 vclient01~10 계정의 사업장(clientOrganizations)을
 * 대대전용(정액2·일반3) + 복합구장(일반5) 데모 구성으로 맞춘다.
 * 사이트 당구장 목록 노출을 위해 isPublished·setupCompleted 도 true로 설정한다.
 *
 *   node scripts/patch-virtual-client-venues.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVirtualVenuePreset } from "./virtual-client-venue-presets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "..", "data", "v3-dev-store.json");

function main() {
  const raw = readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  const now = new Date().toISOString();

  const virtualUsers = (store.users ?? []).filter((u) => {
    const login = String(u.loginId ?? "").toLowerCase();
    const m = /^vclient(\d{2})$/.exec(login);
    if (!m) return false;
    const num = parseInt(m[1], 10);
    return num >= 1 && num <= 10;
  });

  if (virtualUsers.length === 0) {
    console.log("vclient01~10 사용자가 없습니다. 먼저 npm run seed:virtual-clients 를 실행하세요.");
    return;
  }

  let patchedOrgs = 0;
  let patchedApps = 0;
  let patchedUsers = 0;

  for (const user of virtualUsers) {
    const login = String(user.loginId).toLowerCase();
    const m = /^vclient(\d{2})$/.exec(login);
    const n = m ? parseInt(m[1], 10) : NaN;
    if (!Number.isFinite(n) || n < 1 || n > 10) continue;
    const preset = getVirtualVenuePreset(n);

    const org = (store.clientOrganizations ?? []).find((o) => o.clientUserId === user.id);
    if (!org) {
      console.warn(`조직 없음: user ${user.id} (${login})`);
      continue;
    }

    org.name = preset.orgName;
    org.shortDescription = preset.shortDescription;
    org.description = preset.description;
    org.region = preset.region;
    org.address = preset.address;
    org.latitude = preset.latitude;
    org.longitude = preset.longitude;
    org.typeSpecificJson = preset.typeSpecificJson;
    org.isPublished = preset.isPublished;
    org.setupCompleted = preset.setupCompleted;
    org.updatedAt = now;
    patchedOrgs += 1;

    user.name = preset.userDisplayName;
    user.updatedAt = now;
    user.linkedVenueId = org.slug?.trim() || org.id;
    patchedUsers += 1;

    const apps = (store.clientApplications ?? []).filter((a) => a.userId === user.id);
    const latest = apps.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if (latest) {
      latest.organizationName = preset.orgName;
      latest.updatedAt = now;
      patchedApps += 1;
    }
  }

  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`완료: 사용자 ${patchedUsers}명, 사업장 ${patchedOrgs}건, 신청서 ${patchedApps}건 반영.`);
}

main();
