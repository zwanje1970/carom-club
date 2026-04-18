import * as admin from "firebase-admin";

const FCM_CHUNK = 500;

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/unregistered",
]);

let initDone = false;

function ensureFirebaseApp(): void {
  if (initDone) return;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FCM_CREDENTIALS_MISSING");
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  initDone = true;
}

export async function sendFcmToTokens(params: {
  title: string;
  body: string;
  /** 알림 탭 시 WebView에 로드할 경로 또는 절대 URL(선택). FCM data 문자열만 전달. */
  url?: string | null;
  tokens: string[];
}): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  const title = params.title.trim();
  const body = params.body.trim();
  const urlTrim = typeof params.url === "string" ? params.url.trim() : "";
  const unique = [...new Set(params.tokens.map((t) => String(t).trim()).filter(Boolean))];
  if (unique.length === 0 || !title || !body) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  ensureFirebaseApp();
  const messaging = admin.messaging();

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < unique.length; i += FCM_CHUNK) {
    const chunk = unique.slice(i, i + FCM_CHUNK);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      ...(urlTrim ? { data: { url: urlTrim } } : {}),
    });
    successCount += res.successCount;
    failureCount += res.failureCount;
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error?.code;
      const tok = chunk[idx];
      if (code && INVALID_TOKEN_CODES.has(code) && tok) {
        invalidTokens.push(tok);
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
}
