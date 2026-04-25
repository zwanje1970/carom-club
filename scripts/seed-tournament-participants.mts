/**
 * Staging / test only: insert APPROVED v3_tournament_applications rows for bracket testing (no v3_platform_users).
 *
 *   npx --yes tsx scripts/seed-tournament-participants.mts --tournamentId=<id> --dry-run
 *   CONFIRM_STAGING_SEED=YES_I_UNDERSTAND STAGING_SEED_ALLOW_PROJECT_IDS=<id> npx --yes tsx scripts/seed-tournament-participants.mts --tournamentId=<id>
 */
import { randomUUID } from "crypto";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APPLICATIONS = "v3_tournament_applications";
const TOURNAMENTS = "v3_tournaments";

const TEST_SEED_SOURCE = "bracket-e2e-32";
const CONFIRM_STAGING_SEED = "YES_I_UNDERSTAND";

type ParsedArgs = {
  dryRun: boolean;
  tournamentId: string;
  count: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  let dryRun = false;
  let tournamentId = "";
  let count = 32;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--tournament-id" || a === "--tournamentId" || a === "-t") {
      const next = argv[i + 1];
      if (next) {
        tournamentId = next.trim();
        i += 1;
      }
    } else if (a.startsWith("--tournament-id=") || a.startsWith("--tournamentId=")) {
      tournamentId = a.split("=")[1]?.trim() ?? "";
    } else if (a === "--count" || a === "-n") {
      const next = argv[i + 1];
      if (next) {
        const n = Number(next);
        if (Number.isFinite(n) && n > 0) count = Math.min(200, Math.floor(n));
        i += 1;
      }
    } else if (a.startsWith("--count=")) {
      const n = Number(a.split("=")[1]);
      if (Number.isFinite(n) && n > 0) count = Math.min(200, Math.floor(n));
    }
  }
  return { dryRun, tournamentId, count };
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
    console.error("seed-tournament-participants: Refusing to run: NODE_ENV is production.");
    process.exit(1);
  }

  const projectId = getProjectId();
  console.log("seed-tournament-participants: FIREBASE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT):");
  console.log(`  ${projectId || "(missing)"}`);

  if (!projectId) {
    console.error("seed-tournament-participants: Set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
    process.exit(1);
  }

  const allow = getAllowlistFromEnv();
  if (allow.length === 0) {
    console.error(
      "seed-tournament-participants: Set STAGING_SEED_ALLOW_PROJECT_IDS or STAGING_WIPE_ALLOW_PROJECT_IDS (comma-separated allowed project ids)."
    );
    process.exit(1);
  }
  if (!allow.includes(projectId)) {
    console.error(
      `seed-tournament-participants: Project id "${projectId}" is not in the allowlist. Refusing.`
    );
    process.exit(1);
  }

  if (!options.dryRun) {
    if (process.env.CONFIRM_STAGING_SEED !== CONFIRM_STAGING_SEED) {
      console.error(
        `seed-tournament-participants: Blocked. Set CONFIRM_STAGING_SEED=${CONFIRM_STAGING_SEED} for real writes.`
      );
      process.exit(1);
    }
  }
}

function initAdminIfNeeded(): Firestore {
  const projectId = getProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const keyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof keyRaw === "string" && keyRaw.length > 0 ? keyRaw.replace(/\\n/g, "\n") : "";

  const missing: string[] = [];
  if (!projectId) {
    missing.push("FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }
  if (!clientEmail) {
    missing.push("FIREBASE_CLIENT_EMAIL");
  }
  if (typeof keyRaw !== "string" || keyRaw.length === 0 || !privateKey) {
    missing.push("FIREBASE_PRIVATE_KEY");
  }
  if (missing.length > 0) {
    console.error("seed-tournament-participants: Missing: " + missing.join(", "));
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

function buildApplicantIndexLabel(i: string): string {
  return i.padStart(3, "0");
}

function buildPhoneSuffixOneBased(index1: number): string {
  return String(10000 + index1).slice(1);
}

async function tournamentExists(db: Firestore, tournamentId: string): Promise<boolean> {
  const ref = db.collection(TOURNAMENTS).doc(tournamentId);
  const snap = await ref.get();
  return snap.exists;
}

async function hasExistingBracketSeed(
  db: Firestore,
  tournamentId: string
): Promise<boolean> {
  const q = await db.collection(APPLICATIONS).where("tournamentId", "==", tournamentId).get();
  for (const d of q.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data["testSeedSource"] === TEST_SEED_SOURCE) {
      return true;
    }
  }
  return false;
}

function buildRowDoc(tournamentId: string, index1: number, now: string) {
  const label = buildApplicantIndexLabel(String(index1));
  const applicantName = `테스트참가자${label}`;
  const id = randomUUID();
  return {
    id,
    docId: id,
    data: {
      id,
      tournamentId,
      userId: `test-user-${label}`,
      applicantName,
      phone: `010-0000-${buildPhoneSuffixOneBased(index1)}`,
      depositorName: applicantName,
      proofImageId: "seed-bracket-e2e",
      proofImage320Url: "",
      proofImage640Url: "",
      proofOriginalUrl: "",
      ocrStatus: "NOT_REQUESTED",
      ocrText: "",
      ocrRawResult: "",
      ocrRequestedAt: null,
      ocrCompletedAt: null,
      status: "APPROVED",
      createdAt: now,
      updatedAt: now,
      statusChangedAt: now,
      testSeedSource: TEST_SEED_SOURCE,
    } as Record<string, unknown>,
  };
}

async function countApprovedForTournament(db: Firestore, tournamentId: string): Promise<number> {
  const q = await db
    .collection(APPLICATIONS)
    .where("tournamentId", "==", tournamentId)
    .where("status", "==", "APPROVED")
    .get();
  return q.size;
}

async function main(): Promise<void> {
  const { dryRun, tournamentId, count } = parseArgs(process.argv.slice(2));
  assertCanRunOrExit({ dryRun });

  const tid = tournamentId.trim();
  if (!tid) {
    console.error("seed-tournament-participants: --tournamentId <id> is required.");
    process.exit(1);
  }

  const db = initAdminIfNeeded();

  const okT = await tournamentExists(db, tid);
  if (!okT) {
    console.error(`seed-tournament-participants: No document in v3_tournaments for id: ${tid}`);
    process.exit(1);
  }

  const already = await hasExistingBracketSeed(db, tid);
  if (already) {
    console.error(
      `seed-tournament-participants: Existing applications with testSeedSource="${TEST_SEED_SOURCE}" for this tournament. Aborting.`
    );
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = Array.from({ length: count }, (_, i) => buildRowDoc(tid, i + 1, now));

  if (dryRun) {
    console.log(
      `seed-tournament-participants: dry-run — would create ${count} document(s) in ${APPLICATIONS}`
    );
    for (const r of rows.slice(0, 5)) {
      console.log(
        `  sample: id=${r.docId} userId=${r.data["userId"]} applicantName=${r.data["applicantName"]} phone=${r.data["phone"]} depositorName=${r.data["depositorName"]}`
      );
    }
    if (count > 5) {
      console.log("  ...");
    }
    console.log(`  testSeedSource: ${TEST_SEED_SOURCE} (on each doc)`);
    return;
  }

  const batch = db.batch();
  for (const r of rows) {
    batch.set(db.collection(APPLICATIONS).doc(r.docId), r.data);
  }
  await batch.commit();

  const approved = await countApprovedForTournament(db, tid);
  console.log(
    `seed-tournament-participants: committed ${count} application(s). APPROVED count for tournament: ${approved}`
  );
}

main().catch((e) => {
  console.error("seed-tournament-participants: fatal", e);
  process.exit(1);
});
