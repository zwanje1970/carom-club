/**
 * vclient01~10 각각 1개씩 대회(모집중·64명·OCR/자동검증 없음) + 64명 APPROVED 참가 +
 * 브래킷 1라운드 32경기(64강) + 대회 게시카드 10건.
 * 신청·스냅샷·브래킷의 userId 는 무작위 UUID가 아니라 store 의 vplayer01~vplayer64 실제 id 를 사용한다.
 * 증빙은 공용 1개가 아니라 vplayer 로그인별 결정적 proofImage id + uploaderUserId=vplayer 로 64건을 준비한다.
 *
 *   node scripts/seed-virtual-client-tournaments.mjs
 *
 * 삭제 기준: 제목이 아니라 `devSeedSource` + 대회 id(슬롯별 결정적 UUID) + (1회 호환) 구버전 제목 접두어.
 * `DEV_SEED_SOURCE_VIRT_CLIENT_TOURNAMENT_V1` 문자열은 lib/dev-seed-source.ts 와 반드시 동일하게 유지할 것.
 */

import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "..", "data", "v3-local-platform-aggregate.json");

/** dev-seed 출처 문자열 — 반드시 lib/dev-seed-source.ts 와 동일 */
const DEV_SEED_SOURCE_VIRT_CLIENT_TOURNAMENT_V1 = "dev-seed/virt-client-tournament/v1";

/** 구버전 시드만 제거(제목 접두어 + vclient 작성자 + 64인). 일반 대회와 겹치기 어렵게 3조건 동시 만족 */
const LEGACY_TITLE_PREFIX = "[가상64강]";

/** platform-backing stableUserIdFromDevIdentity 와 동일한 UUID 형태 */
function stableUuidFromSeed(seed) {
  const hash = createHash("sha256").update(seed).digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** vclient 슬롯별 고정 대회 id (재실행·제목 변경과 무관) */
function deterministicTournamentIdForLogin(loginIdLower) {
  return stableUuidFromSeed(`v3-dev-seed-virt-client-tournament/v1:${loginIdLower}`);
}

/** vplayer 로그인당 고정 증빙 이미지 id (재시드 시에도 동일 참가자 = 동일 증빙) */
function vplayerProofImageId(loginIdLower) {
  return stableUuidFromSeed(`v3-dev-seed-vplayer-proof/v1:${loginIdLower}`);
}

/** lib/server/proof-images-base-dir.ts 와 동일 규칙(시드 스크립트는 TS 미임포트) */
function getProofImagesBaseDir() {
  const override = process.env.CAROM_PROOF_IMAGES_BASE?.trim();
  if (override) return path.resolve(override);
  if (process.env.VERCEL) return path.join("/tmp", "carom-proof-images");
  return path.join(__dirname, "..", "data", "proof-images");
}

/**
 * vplayer01~64 전용 proofImage store 행 + 디스크 파일(기존 증빙 1건을 바이트 복사).
 * 신청의 proofImageId / uploaderUserId 가 참가자와 일치하도록 한다.
 */
function ensureVplayerProofImagePool(store, virtualPlayers, now) {
  const baseDir = getProofImagesBaseDir();
  const vplayerProofIds = new Set(
    virtualPlayers.map((u) => vplayerProofImageId(String(u.loginId).toLowerCase()))
  );

  store.proofImages = (store.proofImages ?? []).filter((p) => !vplayerProofIds.has(p.id));

  const candidates = store.proofImages ?? [];
  const template =
    candidates.find((p) => p && typeof p.id === "string" && p.id && (p.originalExt === "jpg" || p.originalExt === "png" || p.originalExt === "webp")) ??
    null;
  if (!template) {
    console.error("증빙 템플릿으로 쓸 proofImages 항목이 없습니다.");
    process.exit(1);
  }

  const tid = template.id;
  const ext = template.originalExt;
  const origSrc = path.join(baseDir, "original", `${tid}.${ext}`);
  if (!existsSync(origSrc)) {
    console.error(`증빙 원본 파일이 없습니다: ${origSrc}`);
    process.exit(1);
  }

  const w320TemplateJpg = path.join(baseDir, "w320", `${tid}.jpg`);
  const w320Src = existsSync(w320TemplateJpg) ? w320TemplateJpg : origSrc;
  const w640TemplateJpg = path.join(baseDir, "w640", `${tid}.jpg`);
  const w640Src = existsSync(w640TemplateJpg) ? w640TemplateJpg : origSrc;

  for (const sub of ["original", "w320", "w640"]) {
    mkdirSync(path.join(baseDir, sub), { recursive: true });
  }

  const proofIdByLogin = new Map();
  for (const vUser of virtualPlayers) {
    const loginLower = String(vUser.loginId).toLowerCase();
    const newId = vplayerProofImageId(loginLower);
    const uid = vUser.id;

    store.proofImages.push({
      id: newId,
      uploaderUserId: uid,
      originalExt: ext,
      createdAt: now,
    });

    const origDst = path.join(baseDir, "original", `${newId}.${ext}`);
    copyFileSync(origSrc, origDst);
    copyFileSync(w320Src, path.join(baseDir, "w320", `${newId}.jpg`));
    copyFileSync(w640Src, path.join(baseDir, "w640", `${newId}.jpg`));

    proofIdByLogin.set(loginLower, newId);
  }

  console.log(`vplayer 전용 증빙 이미지 ${virtualPlayers.length}건(store+파일) 준비 완료.`);
  return proofIdByLogin;
}

function collectVirtClientTournamentIdsToRemove(store) {
  const virtualUsers = (store.users ?? []).filter((u) => /^vclient\d{2}$/i.test(String(u.loginId ?? "")));
  const vclientIdSet = new Set(virtualUsers.map((u) => u.id));
  const deterministicIds = new Set(
    virtualUsers.map((u) => deterministicTournamentIdForLogin(String(u.loginId).toLowerCase()))
  );

  const removeIds = new Set();
  for (const t of store.tournaments ?? []) {
    const id = typeof t.id === "string" ? t.id : "";
    if (!id) continue;

    if (t.devSeedSource === DEV_SEED_SOURCE_VIRT_CLIENT_TOURNAMENT_V1) {
      removeIds.add(id);
      continue;
    }
    if (deterministicIds.has(id)) {
      removeIds.add(id);
      continue;
    }
    const legacyTitle =
      typeof t.title === "string" && t.title.startsWith(LEGACY_TITLE_PREFIX);
    const legacyCreator = vclientIdSet.has(t.createdBy);
    const legacy64 = Number(t.maxParticipants) === 64;
    if (legacyTitle && legacyCreator && legacy64 && t.devSeedSource == null) {
      removeIds.add(id);
    }
  }
  return removeIds;
}

function purgeTournamentCascade(store, removeIds) {
  if (removeIds.size === 0) return 0;

  store.tournaments = (store.tournaments ?? []).filter((t) => !removeIds.has(t.id));
  store.tournamentApplications = (store.tournamentApplications ?? []).filter((a) => !removeIds.has(a.tournamentId));
  store.bracketParticipantSnapshots = (store.bracketParticipantSnapshots ?? []).filter((s) => !removeIds.has(s.tournamentId));
  store.brackets = (store.brackets ?? []).filter((b) => !removeIds.has(b.tournamentId));
  store.settlements = (store.settlements ?? []).filter((s) => !removeIds.has(s.tournamentId));
  store.tournamentPublishedCards = (store.tournamentPublishedCards ?? []).filter((c) => !removeIds.has(c.tournamentId));
  store.notifications = (store.notifications ?? []).filter(
    (n) => typeof n.relatedTournamentId !== "string" || !removeIds.has(n.relatedTournamentId)
  );
  store.publishedCardSnapshots = (store.publishedCardSnapshots ?? []).filter((s) => {
    if (s.snapshotSourceType === "TOURNAMENT_SNAPSHOT" && typeof s.tournamentId === "string" && removeIds.has(s.tournamentId)) {
      return false;
    }
    return true;
  });
  store.auditLogs = (store.auditLogs ?? []).filter((log) => {
    const m = log?.meta;
    const tid = m && typeof m === "object" && typeof m.tournamentId === "string" ? m.tournamentId : null;
    return !tid || !removeIds.has(tid);
  });

  return removeIds.size;
}

function proofUrls(imageId) {
  const enc = encodeURIComponent(imageId);
  return {
    proofImage320Url: `/api/proof-images/${enc}?variant=w320`,
    proofImage640Url: `/api/proof-images/${enc}?variant=w640`,
    proofOriginalUrl: `/api/proof-images/${enc}?variant=original`,
  };
}

function ymdPlusDays(base, days) {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** createDefaultTournamentRule + OCR 미사용 */
const DEFAULT_RULE = {
  entryCondition: null,
  entryQualificationType: "NONE",
  verificationMode: "NONE",
  verificationReviewRequired: false,
  verificationGuideText: null,
  eligibilityType: "NONE",
  eligibilityValue: null,
  eligibilityCompare: "LTE",
  divisionEnabled: false,
  divisionMetricType: "AVERAGE",
  divisionRulesJson: null,
  scope: "REGIONAL",
  region: null,
  nationalTournament: false,
  accountNumber: null,
  allowMultipleSlots: false,
  participantsListPublic: true,
  durationType: "1_DAY",
  durationDays: null,
  isScotch: false,
  teamScoreLimit: null,
  teamScoreRule: "LTE",
};

function main() {
  const raw = readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(raw);

  const removeIds = collectVirtClientTournamentIdsToRemove(store);
  const removedCount = purgeTournamentCascade(store, removeIds);
  if (removedCount) {
    console.log(`정리: 시드 대회 ${removedCount}건 및 연관 데이터 제거(제목·날짜 비의존).`);
  }

  const platformUser = (store.users ?? []).find((u) => u.role === "PLATFORM");
  if (!platformUser?.id) {
    console.error("플랫폼 관리자 사용자가 없습니다.");
    process.exit(1);
  }

  const virtualUsers = (store.users ?? [])
    .filter((u) => /^vclient\d{2}$/i.test(String(u.loginId ?? "")))
    .sort((a, b) => String(a.loginId).localeCompare(String(b.loginId)));

  if (virtualUsers.length !== 10) {
    console.error(`vclient01~10 사용자가 필요합니다(현재 ${virtualUsers.length}명).`);
    process.exit(1);
  }

  /** 64강 시드 신청·브래킷 userId — store에 존재하는 vplayer01~vplayer64만 사용(무작위 UUID 금지) */
  const virtualPlayers = (store.users ?? [])
    .filter((u) => /^vplayer\d{2}$/i.test(String(u.loginId ?? "")))
    .sort((a, b) => {
      const na = Number(String(a.loginId).replace(/[^\d]/g, "")) || 0;
      const nb = Number(String(b.loginId).replace(/[^\d]/g, "")) || 0;
      return na - nb;
    });
  if (virtualPlayers.length !== 64) {
    console.error(
      `vplayer01~vplayer64 사용자 64명이 필요합니다(현재 ${virtualPlayers.length}명). 먼저: node scripts/seed-virtual-players.mjs`
    );
    process.exit(1);
  }

  const baseDate = ymdPlusDays(new Date().toISOString().slice(0, 10), 14);
  const now = new Date().toISOString();

  const proofIdByVplayerLogin = ensureVplayerProofImagePool(store, virtualPlayers, now);

  for (let idx = 0; idx < virtualUsers.length; idx += 1) {
    const user = virtualUsers[idx];
    const login = String(user.loginId).toLowerCase();
    const org = (store.clientOrganizations ?? []).find((o) => o.clientUserId === user.id && o.type === "VENUE");
    const orgName = org?.name?.trim() || `${login} 사업장`;
    const venueSlug = org?.slug?.trim() || null;

    const tournamentId = deterministicTournamentIdForLogin(login);
    const title = `64강 시드 데모 — ${orgName} (${login})`;

    const tournament = {
      id: tournamentId,
      title,
      date: ymdPlusDays(baseDate, idx * 3),
      eventDates: null,
      location: orgName,
      extraVenues: null,
      maxParticipants: 64,
      entryFee: 10000,
      createdBy: user.id,
      createdAt: now,
      posterImageUrl: null,
      statusBadge: "모집중",
      summary: `devSeedSource=${DEV_SEED_SOURCE_VIRT_CLIENT_TOURNAMENT_V1} · 가상 시드 · OCR 없음`,
      prizeInfo: null,
      outlineDisplayMode: null,
      outlineHtml: null,
      outlineImageUrl: null,
      outlinePdfUrl: null,
      venueGuideVenueId: venueSlug,
      devSeedSource: DEV_SEED_SOURCE_VIRT_CLIENT_TOURNAMENT_V1,
      rule: { ...DEFAULT_RULE },
    };

    const participants = [];
    const applications = [];

    for (let i = 0; i < 64; i += 1) {
      const vUser = virtualPlayers[i];
      const uid = vUser.id;
      const vLogin = String(vUser.loginId);
      const loginLower = vLogin.toLowerCase();
      const proofId = proofIdByVplayerLogin.get(loginLower);
      if (!proofId) {
        console.error(`vplayer 증빙 id 매핑 누락: ${loginLower}`);
        process.exit(1);
      }
      const pUrls = proofUrls(proofId);
      const applicantName =
        (typeof vUser.name === "string" && vUser.name.trim()) ||
        (typeof vUser.nickname === "string" && vUser.nickname.trim()) ||
        vLogin;
      const phone =
        (typeof vUser.phone === "string" && vUser.phone.trim()) || `0105${String(1000000 + i + 1).slice(-7)}`;
      const appId = randomUUID();
      participants.push({
        userId: uid,
        applicantName,
        phone,
      });
      applications.push({
        id: appId,
        tournamentId,
        userId: uid,
        applicantName,
        phone,
        depositorName: applicantName,
        proofImageId: proofId,
        ...pUrls,
        ocrStatus: "NOT_REQUESTED",
        ocrText: "",
        ocrRawResult: "",
        ocrRequestedAt: null,
        ocrCompletedAt: null,
        status: "APPROVED",
        createdAt: now,
        updatedAt: now,
        statusChangedAt: now,
      });
    }

    const snapshotId = randomUUID();
    const snapshot = {
      id: snapshotId,
      tournamentId,
      participants,
      createdAt: now,
    };

    const matches = [];
    for (let m = 0; m < 32; m += 1) {
      const p1 = participants[m * 2];
      const p2 = participants[m * 2 + 1];
      matches.push({
        id: randomUUID(),
        player1: { userId: p1.userId, name: p1.applicantName },
        player2: { userId: p2.userId, name: p2.applicantName },
        winnerUserId: null,
        winnerName: null,
        status: "PENDING",
      });
    }

    const bracket = {
      id: randomUUID(),
      tournamentId,
      snapshotId,
      rounds: [
        {
          roundNumber: 1,
          matches,
          status: "PENDING",
        },
      ],
      createdAt: now,
    };

    const snapshotIdForCard = randomUUID();
    const card = {
      snapshotId: snapshotIdForCard,
      tournamentId,
      title,
      textLine1: "64강 본선",
      textLine2: `${tournament.date} · ${orgName}`,
      templateType: "A",
      backgroundType: "theme",
      themeType: idx % 3 === 0 ? "dark" : idx % 3 === 1 ? "light" : "natural",
      image320Url: "",
      imageId: "theme",
      status: "모집중",
      targetDetailUrl: `/site/tournaments/${tournamentId}`,
      publishedAt: now,
      updatedAt: now,
      isPublished: true,
      isActive: true,
      version: 1,
      publishedBy: platformUser.id,
      showOnMainSlide: true,
      deadlineSortValue: tournament.date,
    };

    store.tournaments.push(tournament);
    store.tournamentApplications.push(...applications);
    store.bracketParticipantSnapshots.push(snapshot);
    store.brackets.push(bracket);
    store.tournamentPublishedCards.push(card);

    console.log(`${login} → ${tournamentId} (${title})`);
  }

  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`완료: 가상 클라이언트 ${virtualUsers.length}명 × 대회·64강 브래킷·게시카드 반영.`);
}

main();
