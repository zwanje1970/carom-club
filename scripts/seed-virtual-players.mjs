/**
 * 로컬 aggregate JSON에 가상 참가자 일반 회원(USER) 64명을 넣는다.
 * 64강 브래킷·신청 연결 테스트용 풀 — 클라이언트(vclient*)와 분리된다.
 *
 *   node scripts/seed-virtual-players.mjs
 *
 * 이미 vplayer01~vplayer64 가 있으면 해당 loginId 는 건너뛴다(재실행 안전).
 * 이메일 도메인: @virtual-player.dev (가상 클라이언트 @virtual.demo 와 구분)
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "..", "data", "v3-local-platform-aggregate.json");

const PLAYER_COUNT = 64;

/** seed-virtual-clients.mjs 와 동일 — 이메일 기준 결정적 user id */
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

  const now = new Date().toISOString();
  const added = [];

  for (let n = 1; n <= PLAYER_COUNT; n += 1) {
    const loginId = `vplayer${String(n).padStart(2, "0")}`;
    const exists = store.users.some((u) => String(u.loginId).toLowerCase() === loginId);
    if (exists) {
      console.log(`건너뜀(이미 있음): ${loginId}`);
      continue;
    }

    const email = `${loginId}@virtual-player.dev`;
    const userId = stableUserIdFromDevIdentity({ email, phone: null });
    const phone = `0105${String(1000000 + n).slice(-7)}`;
    const password = `${loginId}pw`;
    const displayName = `[데모참가자] ${loginId}`;

    store.users.push({
      id: userId,
      loginId,
      nickname: loginId,
      name: displayName,
      email,
      phone,
      password,
      role: "USER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      linkedVenueId: null,
      pushMarketingAgreed: false,
    });

    added.push({ loginId, password, userId });
  }

  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  if (added.length === 0) {
    console.log(`추가된 계정 없음. vplayer01~vplayer${String(PLAYER_COUNT).padStart(2, "0")}이 이미 존재합니다.`);
    return;
  }

  console.log(`추가 완료: ${added.length}명 (USER · 로컬 시드 풀)`);
  for (const row of added) {
    console.log(`  ${row.loginId} / ${row.password}`);
  }
}

main();
