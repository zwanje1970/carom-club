import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FIREBASE_SW_VERSION = "11.10.0";

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    return new NextResponse("// FCM web: Firebase web env not set\n", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Service-Worker-Allowed": "/",
        "Cache-Control": "no-store",
      },
    });
  }

  const authDomain =
    (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim() || `${projectId}.firebaseapp.com`;
  const appConfig = { apiKey, authDomain, projectId, messagingSenderId, appId };

  const body = `importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SW_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SW_VERSION}/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(appConfig)});
firebase.messaging();
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "private, no-store",
    },
  });
}
