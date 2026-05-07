/**
 * 테스트 전용: `aaaaaa` 계정이 작성자인 「가상대회32강전」(모집 32명) + APPLIED 신청 30건.
 * 승인·입금 처리 없음. 대진표 컬렉션에는 쓰지 않음.
 *
 *   npx --yes tsx --env-file=.env.local scripts/seed-virtual-tournament32-applied30.mts --dry-run
 *   CONFIRM_STAGING_SEED=YES_I_UNDERSTAND STAGING_SEED_ALLOW_PROJECT_IDS=<projectId> npx --yes tsx --env-file=.env.local scripts/seed-virtual-tournament32-applied30.mts
 */
import { randomUUID } from "crypto";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const SEED = "cursor-seed/virtual-tournament-32-applied30-v1";
const LOGIN = "aaaaaa";
const TITLE = "가상대회32강전";
const APPLICATIONS = "v3_tournament_applications";
const TOURNAMENTS = "v3_tournaments";
const BRACKETS = "v3_tournament_brackets";
const USERS = "v3_platform_users";

const CONFIRM_STAGING_SEED = "YES_I_UNDERSTAND";

/** createDefaultTournamentRule 와 동일 스냅샷(검증 통과용). */
const DEFAULT_RULE: Record<string, unknown> = {
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

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

function getProjectId(): string {
  return process.env.FIREBASE_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || "";
}

function getAllowlistFromEnv(): string[] {
  const a = process.env.STAGING_SEED_ALLOW_PROJECT_IDS?.trim();
  const b = process.env.STAGING_WIPE_ALLOW_PROJECT_IDS?.trim();
  const parts = [a, b].filter((x): x is string => Boolean(x));
  if (parts.length === 0) return [];
  return [...new Set(parts.join(",").split(",").map((s) => s.trim()).filter(Boolean))];
}

function assertCanRunOrExit(options: { dryRun: boolean }): void {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing: NODE_ENV is production.");
    process.exit(1);
  }
  const projectId = getProjectId();
  console.log("FIREBASE_PROJECT_ID:", projectId || "(missing)");
  if (!projectId) {
    console.error("Set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
    process.exit(1);
  }
  const allow = getAllowlistFromEnv();
  if (allow.length === 0) {
    console.error("Set STAGING_SEED_ALLOW_PROJECT_IDS or STAGING_WIPE_ALLOW_PROJECT_IDS.");
    process.exit(1);
  }
  if (!allow.includes(projectId)) {
    console.error(`Project "${projectId}" not in allowlist.`);
    process.exit(1);
  }
  if (!options.dryRun && process.env.CONFIRM_STAGING_SEED !== CONFIRM_STAGING_SEED) {
    console.error(`Set CONFIRM_STAGING_SEED=${CONFIRM_STAGING_SEED} for writes.`);
    process.exit(1);
  }
}

function initAdminIfNeeded(): Firestore {
  const projectId = getProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const keyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof keyRaw === "string" && keyRaw.length > 0 ? keyRaw.replace(/\\n/g, "\n") : "";
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.");
    process.exit(1);
  }
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  return getFirestore();
}

async function findCreatorUserId(db: Firestore): Promise<string> {
  const q = await db.collection(USERS).where("loginIdNorm", "==", LOGIN.toLowerCase()).limit(1).get();
  if (q.empty) {
    throw new Error(`No v3_platform_users with loginIdNorm=${LOGIN}`);
  }
  return q.docs[0]!.id;
}

function buildApplicationDoc(tournamentId: string, index1: number, now: string): { id: string; data: Record<string, unknown> } {
  const id = randomUUID();
  const applicantName = `테스트${index1}`;
  const phoneLast = String(10000 + index1).slice(1);
  return {
    id,
    data: {
      id,
      tournamentId,
      userId: `${SEED}:applicant:${index1}:${id}`,
      applicantName,
      phone: `010-0000-${phoneLast}`,
      depositorName: applicantName,
      proofImageId: "",
      proofImage320Url: "",
      proofImage640Url: "",
      proofOriginalUrl: "",
      ocrStatus: "NOT_REQUESTED",
      ocrText: "",
      ocrRawResult: "",
      ocrRequestedAt: null,
      ocrCompletedAt: null,
      status: "APPLIED",
      createdAt: now,
      updatedAt: now,
      statusChangedAt: now,
      testSeedSource: SEED,
    },
  };
}

async function tryRebuildPublicTournamentSnapshots(): Promise<void> {
  try {
    const { rebuildSitePublicTournamentListSnapshots } = await import(
      "../lib/server/site-public-list-snapshots-kv"
    );
    await rebuildSitePublicTournamentListSnapshots();
    console.log("공개 대회 목록 스냅샷 rebuild 호출 완료.");
  } catch (e) {
    console.warn("스냅샷 rebuild 생략 또는 실패(환경에 따라 정상):", (e as Error)?.message ?? e);
  }
}

async function verify(db: Firestore, tournamentId: string): Promise<void> {
  const tSnap = await db.collection(TOURNAMENTS).doc(tournamentId).get();
  const t = tSnap.data() as Record<string, unknown> | undefined;
  console.log("\n--- 검증 ---");
  console.log("1. 대회 존재:", tSnap.exists ? "성공" : "실패");
  console.log("   제목:", t?.title ?? "(없음)");

  const appsQ = await db.collection(APPLICATIONS).where("tournamentId", "==", tournamentId).get();
  const apps: Array<Record<string, unknown> & { id: string }> = appsQ.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));
  console.log("2. 신청 건수:", apps.length, apps.length === 30 ? "(성공)" : "(실패: 30명 아님)");

  const names = new Set(
    apps.map((a) => (typeof a.applicantName === "string" ? a.applicantName.trim() : "")).filter(Boolean),
  );
  let missingName = false;
  for (let i = 1; i <= 30; i += 1) {
    if (!names.has(`테스트${i}`)) missingName = true;
  }
  console.log("3. 테스트1~테스트30 이름:", missingName ? "실패" : "성공");

  const badStatus = apps.filter((a) => a.status !== "APPLIED");
  console.log("4. 전원 APPLIED(미승인):", badStatus.length === 0 ? "성공" : `실패 (${badStatus.length}건 다른 상태)`);

  const approved = apps.filter((a) => a.status === "APPROVED");
  console.log("5·6. 승인(APPROVED) 없음:", approved.length === 0 ? "성공" : `실패 (${approved.length}건)`);

  const maxP = typeof t?.maxParticipants === "number" ? t.maxParticipants : Number(t?.maxParticipants);
  const slotsLeft = Number.isFinite(maxP) ? maxP - apps.length : NaN;
  console.log("7. 잔여 신청 가능(32−신청수):", Number.isFinite(slotsLeft) ? `${slotsLeft}명` : "?", slotsLeft === 2 ? "(성공)" : "(확인 필요)");

  const brQ = await db.collection(BRACKETS).where("tournamentId", "==", tournamentId).limit(5).get();
  console.log("8. 대진표 문서 수(0 기대):", brQ.size === 0 ? `성공 (${brQ.size})` : `실패 (${brQ.size})`);

  console.log(
    "9. 공개 메인 라우트/번들 코드는 변경하지 않음 (DB 시드만). 작업 범위 기준 성공.",
  );
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));
  assertCanRunOrExit({ dryRun });

  const db = initAdminIfNeeded();
  const existingTour = await db.collection(TOURNAMENTS).where("devSeedSource", "==", SEED).limit(1).get();

  let tournamentId: string;

  if (!existingTour.empty) {
    tournamentId = existingTour.docs[0]!.id;
    console.log(`기존 시드 대회 재사용: id=${tournamentId}`);
  } else if (dryRun) {
    const creator = await findCreatorUserId(db);
    console.log(`dry-run: would create tournament title="${TITLE}" createdBy=${creator} maxParticipants=32`);
    console.log("dry-run: would insert 30 APPLIED applications");
    return;
  } else {
    const createdBy = await findCreatorUserId(db);
    tournamentId = randomUUID();
    const now = new Date().toISOString();
    const doc: Record<string, unknown> = {
      id: tournamentId,
      title: TITLE,
      date: "2026-12-20",
      eventDates: null,
      location: "테스트 장소",
      extraVenues: null,
      maxParticipants: 32,
      entryFee: 0,
      createdBy,
      createdAt: now,
      posterImageUrl: null,
      statusBadge: "모집중",
      summary: null,
      prizeInfo: null,
      outlineDisplayMode: null,
      outlineHtml: null,
      outlineImageUrl: null,
      outlinePdfUrl: null,
      venueGuideVenueId: null,
      rule: DEFAULT_RULE,
      devSeedSource: SEED,
    };
    await db.collection(TOURNAMENTS).doc(tournamentId).set(doc);
    console.log(`대회 문서 작성: id=${tournamentId}`);
    await tryRebuildPublicTournamentSnapshots();
  }

  const existingAppsSnap = await db.collection(APPLICATIONS).where("tournamentId", "==", tournamentId).get();
  const seededCount = existingAppsSnap.docs.filter((d) => (d.data() as Record<string, unknown>).testSeedSource === SEED).length;

  if (seededCount >= 30) {
    console.log(`신청 ${seededCount}건 이미 있음 — 스킵`);
    await verify(db, tournamentId);
    return;
  }

  if (dryRun) {
    await verify(db, tournamentId);
    return;
  }

  if (seededCount > 0 && seededCount < 30) {
    console.error(`부분 신청 ${seededCount}건만 있음. 수동 정리 후 재실행하세요.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = Array.from({ length: 30 }, (_, i) => buildApplicationDoc(tournamentId, i + 1, now));
  const batch = db.batch();
  for (const r of rows) {
    batch.set(db.collection(APPLICATIONS).doc(r.id), r.data);
  }
  await batch.commit();
  console.log(`신청 30건(APPLIED) 커밋 완료`);

  await verify(db, tournamentId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
