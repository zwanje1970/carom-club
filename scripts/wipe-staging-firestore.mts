/**
 * Staging / test only: delete Firestore tournament + client data and tournamentPublishedCards KV.
 * Never run against production. See guards at the top of main().
 *
 * Run (requires firebase-admin env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY):
 *   npx --yes tsx scripts/wipe-staging-firestore.mts --dry-run
 *   CONFIRM_STAGING_WIPE=YES_I_UNDERSTAND STAGING_WIPE_ALLOW_PROJECT_IDS=<id> npx --yes tsx scripts/wipe-staging-firestore.mts
 */
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { FieldPath, getFirestore, type Firestore } from "firebase-admin/firestore";

const FIRESTORE_COLLECTIONS_IN_ORDER: readonly string[] = [
  "v3_tournament_applications",
  "v3_tournament_participant_snapshots",
  "v3_tournament_brackets",
  "v3_tournament_settlements",
  "v3_tournaments",
  "v3_client_applications",
  "v3_client_organizations",
] as const;

const PLATFORM_KV_COLLECTION = "v3_platform_kv_settings";
const TOURNAMENT_PUBLISHED_CARDS_KEY = "tournamentPublishedCards";

const CONFIRM_VALUE = "YES_I_UNDERSTAND";

function parseArgs(argv: string[]): { dryRun: boolean } {
  const dryRun = argv.includes("--dry-run");
  return { dryRun };
}

function getProjectId(): string {
  const fromFirebase = process.env.FIREBASE_PROJECT_ID?.trim();
  const fromGcp = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  return fromFirebase || fromGcp || "";
}

function getAllowlist(): string[] {
  const raw = process.env.STAGING_WIPE_ALLOW_PROJECT_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertCanRunOrExit(options: { dryRun: boolean }): void {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "wipe-staging-firestore: Refusing to run: NODE_ENV is production. This script is not for production."
    );
    process.exit(1);
  }

  const projectId = getProjectId();
  console.log("wipe-staging-firestore: effective project id (FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT):");
  console.log(`  ${projectId || "(missing)"}`);

  if (!projectId) {
    console.error("wipe-staging-firestore: Set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT and credentials.");
    process.exit(1);
  }

  const allow = getAllowlist();
  if (allow.length === 0) {
    console.error(
      "wipe-staging-firestore: Set STAGING_WIPE_ALLOW_PROJECT_IDS to a comma-separated list of allowed Firestore project ids (staging only)."
    );
    process.exit(1);
  }
  if (!allow.includes(projectId)) {
    console.error(
      `wipe-staging-firestore: Project id "${projectId}" is not in STAGING_WIPE_ALLOW_PROJECT_IDS. Refusing.`
    );
    process.exit(1);
  }

  if (!options.dryRun) {
    if (process.env.CONFIRM_STAGING_WIPE !== CONFIRM_VALUE) {
      console.error(
        `wipe-staging-firestore: Real delete is blocked. Set CONFIRM_STAGING_WIPE=${CONFIRM_VALUE} (and use a staging allowlisted project).`
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
    console.error(
      "wipe-staging-firestore: Missing or invalid required environment variable(s): " + missing.join(", ")
    );
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

/**
 * Count all docs and up to 5 sample ids without mutating.
 */
async function countCollectionPaged(
  db: Firestore,
  collectionId: string
): Promise<{ total: number; sampleIds: string[] }> {
  const col = db.collection(collectionId);
  let total = 0;
  const sampleIds: string[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q: FirebaseFirestore.Query = col.orderBy(FieldPath.documentId()).limit(500);
    if (last) {
      q = q.startAfter(last);
    }
    const snap = await q.get();
    if (snap.empty) break;
    total += snap.size;
    for (const d of snap.docs) {
      if (sampleIds.length < 5) {
        sampleIds.push(d.id);
      }
    }
    if (snap.size < 500) break;
    last = snap.docs[snap.docs.length - 1] ?? null;
    if (!last) break;
  }
  return { total, sampleIds };
}

/**
 * Delete in chunks of 500; each chunk uses a new query after previous deletes committed.
 */
async function deleteCollectionInBatches(db: Firestore, collectionId: string): Promise<number> {
  const col = db.collection(collectionId);
  let deleted = 0;
  for (;;) {
    const snap = await col.limit(500).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function runDryRunSummary(db: Firestore): Promise<void> {
  console.log("\n--- dry-run: Firestore (document counts, sample ids) ---\n");
  for (const c of FIRESTORE_COLLECTIONS_IN_ORDER) {
    const { total, sampleIds } = await countCollectionPaged(db, c);
    console.log(`${c}: ${total} document(s)`);
    if (sampleIds.length) {
      console.log(`  sample ids: ${sampleIds.join(", ")}${total > 5 ? " ..." : ""}`);
    }
  }
  const kvRef = db.collection(PLATFORM_KV_COLLECTION).doc(TOURNAMENT_PUBLISHED_CARDS_KEY);
  const kvSnap = await kvRef.get();
  console.log(
    `\n${PLATFORM_KV_COLLECTION}/${TOURNAMENT_PUBLISHED_CARDS_KEY}: ${kvSnap.exists ? "1 document (would be deleted)" : "0 (missing, no-op)"}`
  );
  console.log("\n--- end dry-run (no deletions performed) ---\n");
}

async function wipeForReal(db: Firestore): Promise<void> {
  console.log("\n--- deleting Firestore collections (order preserved) ---\n");
  for (const c of FIRESTORE_COLLECTIONS_IN_ORDER) {
    const n = await deleteCollectionInBatches(db, c);
    console.log(`${c}: deleted ${n} document(s)`);
  }
  const kvRef = db.collection(PLATFORM_KV_COLLECTION).doc(TOURNAMENT_PUBLISHED_CARDS_KEY);
  const snap = await kvRef.get();
  if (snap.exists) {
    await kvRef.delete();
    console.log(`\n${PLATFORM_KV_COLLECTION}/${TOURNAMENT_PUBLISHED_CARDS_KEY}: deleted`);
  } else {
    console.log(`\n${PLATFORM_KV_COLLECTION}/${TOURNAMENT_PUBLISHED_CARDS_KEY}: (already missing)`);
  }
  console.log("\n--- wipe finished ---\n");
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv);
  assertCanRunOrExit({ dryRun });

  const db = initAdminIfNeeded();

  if (dryRun) {
    await runDryRunSummary(db);
  } else {
    await wipeForReal(db);
  }
}

main().catch((e) => {
  console.error("wipe-staging-firestore: fatal", e);
  process.exit(1);
});
