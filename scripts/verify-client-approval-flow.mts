/**
 * Manual / CI-staging: find latest PENDING client application in Firestore, approve via
 * `updateClientApplicationStatusFirestore` (same path as platform API), then re-read Firestore to verify.
 *
 * Not part of production deploy. Requires Firebase admin env vars.
 *
 *   VERIFY_CLIENT_APPROVAL_ALLOW_PROJECT_IDS=<projectId> \
 *   CONFIRM_VERIFY_CLIENT_APPROVAL=YES_I_UNDERSTAND \
 *   npm run verify:client-approval
 *
 * Optional: VERIFY_REVIEWER_USER_ID=<platformUserDocId> (stored on application as reviewedByUserId)
 */
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** `lib/server/firestore-client-applications.ts`와 동일 (tsx named const import 회피) */
const V3_CLIENT_APPLICATIONS = "v3_client_applications";
const V3_CLIENT_ORGANIZATIONS = "v3_client_organizations";
const V3_PLATFORM_USERS = "v3_platform_users";
const CONFIRM_VALUE = "YES_I_UNDERSTAND";

function getProjectId(): string {
  return process.env.FIREBASE_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || "";
}

function getAllowlist(): string[] {
  const raw = process.env.VERIFY_CLIENT_APPROVAL_ALLOW_PROJECT_IDS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function assertPreconditions(): void {
  if (process.env.NODE_ENV === "production") {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Refusing: NODE_ENV is production. Run with NODE_ENV unset or development.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.error(
      JSON.stringify({ ok: false, error: "Missing FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT." }, null, 2)
    );
    process.exit(1);
  }

  const allow = getAllowlist();
  if (allow.length === 0 || !allow.includes(projectId)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: `Set VERIFY_CLIENT_APPROVAL_ALLOW_PROJECT_IDS to include "${projectId}".`,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (process.env.CONFIRM_VERIFY_CLIENT_APPROVAL !== CONFIRM_VALUE) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: `Set CONFIRM_VERIFY_CLIENT_APPROVAL=${CONFIRM_VALUE} to perform approval.`,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const keyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey =
    typeof keyRaw === "string" && keyRaw.length > 0 ? keyRaw.replace(/\\n/g, "\n") : "";
  if (!clientEmail || !privateKey) {
    console.error(
      JSON.stringify({ ok: false, error: "Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY." }, null, 2)
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
}

async function findLatestPendingApplicationId(db: Firestore): Promise<{
  applicationId: string;
  userId: string;
  statusBefore: string;
  createdAt: string;
} | null> {
  const snap = await db.collection(V3_CLIENT_APPLICATIONS).orderBy("createdAt", "desc").limit(200).get();
  for (const d of snap.docs) {
    const st = d.get("status");
    if (st === "PENDING") {
      const userId = String(d.get("userId") ?? "").trim();
      if (!userId) continue;
      return {
        applicationId: d.id,
        userId,
        statusBefore: "PENDING",
        createdAt: typeof d.get("createdAt") === "string" ? d.get("createdAt") : "",
      };
    }
  }
  return null;
}

async function readVerificationSnapshot(
  db: Firestore,
  applicationId: string,
  userId: string
): Promise<{
  applicationStatus: string | null;
  organizationExists: boolean;
  organizationId: string;
  userRole: string | null;
}> {
  const orgId = `client-org-${userId}`;
  const [appSnap, orgSnap, userSnap] = await Promise.all([
    db.collection(V3_CLIENT_APPLICATIONS).doc(applicationId).get(),
    db.collection(V3_CLIENT_ORGANIZATIONS).doc(orgId).get(),
    db.collection(V3_PLATFORM_USERS).doc(userId).get(),
  ]);
  return {
    applicationStatus: appSnap.exists ? (appSnap.get("status") as string) : null,
    organizationExists: orgSnap.exists,
    organizationId: orgId,
    userRole: userSnap.exists ? (userSnap.get("role") as string) : null,
  };
}

async function main(): Promise<void> {
  const { updateClientApplicationStatusFirestore } = await import("../lib/server/firestore-client-applications");
  assertPreconditions();
  const db = getFirestore();
  const pending = await findLatestPendingApplicationId(db);
  if (!pending) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "No PENDING application found in v3_client_applications (scanned last 200 by createdAt desc).",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const reviewer =
    process.env.VERIFY_REVIEWER_USER_ID?.trim() || "verify-client-approval-flow";

  const beforeVerify = await readVerificationSnapshot(db, pending.applicationId, pending.userId);

  let updatedApp: Awaited<ReturnType<typeof updateClientApplicationStatusFirestore>>;
  try {
    updatedApp = await updateClientApplicationStatusFirestore(pending.applicationId, {
      status: "APPROVED",
      reviewedByUserId: reviewer,
    });
  } catch (e) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          applicationId: pending.applicationId,
          userId: pending.userId,
          statusBefore: pending.statusBefore,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!updatedApp) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          applicationId: pending.applicationId,
          error: "updateClientApplicationStatusFirestore returned null.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const afterVerify = await readVerificationSnapshot(db, pending.applicationId, pending.userId);

  const checks = {
    applicationApproved: afterVerify.applicationStatus === "APPROVED",
    organizationPresent: afterVerify.organizationExists,
    userRoleClient: afterVerify.userRole === "CLIENT",
  };

  const ok = checks.applicationApproved && checks.organizationPresent && checks.userRoleClient;
  console.log(
    JSON.stringify(
      {
        ok,
        applicationId: pending.applicationId,
        userId: pending.userId,
        statusBefore: pending.statusBefore,
        statusAfter: updatedApp.status,
        beforeStatus: pending.statusBefore,
        afterStatus: updatedApp.status,
        reviewedByUserId: updatedApp.reviewedByUserId,
        organizationId: afterVerify.organizationId,
        organizationExists: afterVerify.organizationExists,
        userRoleAfter: afterVerify.userRole,
        userRole: afterVerify.userRole,
        checks,
        snapshotBeforeApprove: beforeVerify,
        snapshotAfterApprove: afterVerify,
      },
      null,
      2
    )
  );

  if (!checks.applicationApproved || !checks.organizationPresent || !checks.userRoleClient) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
      null,
      2
    )
  );
  process.exit(1);
});
