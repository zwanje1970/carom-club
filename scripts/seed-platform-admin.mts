/**
 * Staging / local manual only: create or patch a PLATFORM admin in Firestore `v3_platform_users`.
 * Never wire this into production deploy automation.
 *
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * Requires: ADMIN_LOGIN_ID, ADMIN_PASSWORD, ADMIN_NAME
 * Optional: ADMIN_EMAIL (stored lowercased; default null)
 *
 * Allowlist: STAGING_SEED_ALLOW_PROJECT_IDS or STAGING_WIPE_ALLOW_PROJECT_IDS (comma-separated).
 * Writes: CONFIRM_STAGING_SEED=YES_I_UNDERSTAND (unless --dry-run).
 *
 *   npx --yes tsx scripts/seed-platform-admin.mts --dry-run
 *   CONFIRM_STAGING_SEED=YES_I_UNDERSTAND STAGING_SEED_ALLOW_PROJECT_IDS=<id> npx --yes tsx scripts/seed-platform-admin.mts
 */
import { randomUUID } from "node:crypto";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const COLLECTION = "v3_platform_users";
const CONFIRM_VALUE = "YES_I_UNDERSTAND";

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

function getProjectId(): string {
  const fromFirebase = process.env.FIREBASE_PROJECT_ID?.trim();
  const fromGcp = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  return fromFirebase || fromGcp || "";
}

function getAllowlist(): string[] {
  const raw =
    process.env.STAGING_SEED_ALLOW_PROJECT_IDS?.trim() || process.env.STAGING_WIPE_ALLOW_PROJECT_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertEnvironmentOrExit(options: { dryRun: boolean }): void {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "seed-platform-admin: Refusing to run: NODE_ENV is production. Run from a shell with NODE_ENV unset or development."
    );
    process.exit(1);
  }

  const projectId = getProjectId();
  console.log("seed-platform-admin: FIREBASE_PROJECT_ID (effective, from env):");
  console.log(`  ${projectId || "(missing — set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT)"}`);

  if (!projectId) {
    console.error("seed-platform-admin: Missing project id.");
    process.exit(1);
  }

  const allow = getAllowlist();
  if (allow.length === 0) {
    console.error(
      "seed-platform-admin: Set STAGING_SEED_ALLOW_PROJECT_IDS or STAGING_WIPE_ALLOW_PROJECT_IDS to a comma-separated list of allowed Firestore project ids."
    );
    process.exit(1);
  }
  if (!allow.includes(projectId)) {
    console.error(
      `seed-platform-admin: Project id "${projectId}" is not in the allowlist. Refusing.`
    );
    process.exit(1);
  }

  if (!options.dryRun && process.env.CONFIRM_STAGING_SEED !== CONFIRM_VALUE) {
    console.error(
      `seed-platform-admin: Writes blocked. Set CONFIRM_STAGING_SEED=${CONFIRM_VALUE} or use --dry-run.`
    );
    process.exit(1);
  }
}

function initAdminIfNeeded(): Firestore {
  const projectId = getProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const keyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof keyRaw === "string" && keyRaw.length > 0 ? keyRaw.replace(/\\n/g, "\n") : "";

  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (typeof keyRaw !== "string" || keyRaw.length === 0 || !privateKey) missing.push("FIREBASE_PRIVATE_KEY");
  if (missing.length > 0) {
    console.error("seed-platform-admin: Missing: " + missing.join(", "));
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

function nicknameKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAdminInputs(): { loginId: string; password: string; name: string; email: string | null } {
  const loginId = process.env.ADMIN_LOGIN_ID?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const name = process.env.ADMIN_NAME?.trim() ?? "";
  const emailRaw = process.env.ADMIN_EMAIL?.trim();
  const email = emailRaw ? emailRaw.toLowerCase() : null;

  if (!loginId || !password || !name) {
    console.error("seed-platform-admin: Set ADMIN_LOGIN_ID, ADMIN_PASSWORD, and ADMIN_NAME.");
    process.exit(1);
  }
  return { loginId, password, name, email };
}

function userDocPayload(params: {
  docId: string;
  loginId: string;
  password: string;
  name: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  const { docId, loginId, password, name, email, createdAt, updatedAt } = params;
  const phoneDigits = "";
  const nickname = loginId;
  return {
    id: docId,
    loginId,
    loginIdNorm: loginId.toLowerCase(),
    nickname,
    nicknameKey: nicknameKey(nickname),
    name,
    email,
    emailNorm: email,
    phone: null,
    phoneDigits: phoneDigits || null,
    password,
    role: "PLATFORM",
    status: "ACTIVE",
    createdAt,
    updatedAt,
    linkedVenueId: null,
    pushMarketingAgreed: true,
  };
}

function summarizeExisting(data: Record<string, unknown> | undefined, docId: string): void {
  if (!data || typeof data !== "object") {
    console.log("seed-platform-admin: (no existing document data)");
    return;
  }
  const pw = typeof data.password === "string" ? data.password : "";
  console.log("seed-platform-admin: existing document report (password omitted, length only):");
  console.log(
    JSON.stringify(
      {
        docId,
        id: data.id,
        loginId: data.loginId,
        loginIdNorm: data.loginIdNorm,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        nickname: data.nickname,
        nicknameKey: data.nicknameKey,
        passwordLength: pw.length,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv);
  assertEnvironmentOrExit({ dryRun });
  const { loginId, password, name, email } = normalizeAdminInputs();

  const db = initAdminIfNeeded();
  const loginIdNorm = loginId.toLowerCase();
  const q = await db.collection(COLLECTION).where("loginIdNorm", "==", loginIdNorm).limit(4).get();

  if (q.docs.length > 1) {
    console.error("seed-platform-admin: Multiple users share loginIdNorm; fix data manually.");
    process.exit(1);
  }

  const now = new Date().toISOString();

  if (q.empty) {
    const docId = randomUUID();
    const payload = userDocPayload({
      docId,
      loginId,
      password,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    });
    console.log("seed-platform-admin: plan — CREATE new document");
    console.log(JSON.stringify({ docId, fieldsExceptPassword: { ...payload, password: "(set)" } }, null, 2));
    if (dryRun) {
      console.log("seed-platform-admin: --dry-run: no write performed.");
      return;
    }
    await db.collection(COLLECTION).doc(docId).set(payload);
    console.log(`seed-platform-admin: created v3_platform_users/${docId}`);
    return;
  }

  const doc = q.docs[0]!;
  const docId = doc.id;
  const data = doc.data() as Record<string, unknown> | undefined;
  summarizeExisting(data, docId);

  const createdAtExisting =
    typeof data?.createdAt === "string" && data.createdAt.trim() ? data.createdAt.trim() : now;
  const payload = userDocPayload({
    docId,
    loginId,
    password,
    name,
    email: email ?? (typeof data?.email === "string" ? String(data.email).trim().toLowerCase() || null : null),
    createdAt: createdAtExisting,
    updatedAt: now,
  });

  const patchFields: Record<string, unknown> = {
    id: docId,
    loginId,
    loginIdNorm: loginId.toLowerCase(),
    nickname: loginId,
    nicknameKey: nicknameKey(loginId),
    name,
    password,
    role: "PLATFORM",
    status: "ACTIVE",
    updatedAt: now,
  };
  if (email != null) {
    patchFields.email = email;
    patchFields.emailNorm = email;
  }

  console.log("seed-platform-admin: plan — PATCH (role PLATFORM, status ACTIVE, password, name, login* / nickname*; email only if ADMIN_EMAIL set)");
  console.log(JSON.stringify({ docId, patchFields: { ...patchFields, password: "(set)" } }, null, 2));

  if (dryRun) {
    console.log("seed-platform-admin: --dry-run: no write performed.");
    return;
  }

  await doc.ref.update(patchFields);
  console.log(`seed-platform-admin: updated v3_platform_users/${docId}`);
}

main().catch((e) => {
  console.error("seed-platform-admin: failed", e);
  process.exit(1);
});
