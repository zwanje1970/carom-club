import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getUserById,
  resolveCanonicalUserIdForAuth,
} from "../../../../lib/platform-api";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";
import { isFirestoreUsersBackendConfigured } from "../../../../lib/server/firestore-users";
import { persistProofImageW320W640Variants } from "../../../../lib/server/persist-proof-image-w320-w640-variants";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERVER_CARD_IMAGE_FAIL_KO = "게시 이미지 생성 또는 저장에 실패했습니다. 다시 게시해 주세요.";
const MULTIPART_ONLY_KO = "게시 카드 이미지는 브라우저에서 캡처한 PNG(multipart)만 업로드할 수 있습니다.";

function tournamentImageDiagEnabled(): boolean {
  return process.env.TOURNAMENT_CARD_IMAGE_DIAG === "1";
}

async function publisherTournamentOwnerId(user: { id: string; role: string }): Promise<string> {
  if (user.role === "PLATFORM") return user.id;
  return resolveCanonicalUserIdForAuth(user.id);
}

async function getPublisher() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, error: "Login is required.", status: 401 };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, error: "User not found.", status: 401 };

  if (user.role === "PLATFORM") return { ok: true as const, user };
  if (user.role !== "CLIENT") return { ok: false as const, error: "CLIENT role is required.", status: 403 };

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { ok: false as const, error: "Only APPROVED clients can publish.", status: 403 };
  }

  return { ok: true as const, user };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function assertTournamentImageAccess(params: {
  publisher: { user: { id: string; role: string } };
  tournamentId: string;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { publisher, tournamentId } = params;
  let tournament: Awaited<ReturnType<typeof getTournamentByIdFirestore>>;
  try {
    tournament = await getTournamentByIdFirestore(tournamentId);
  } catch {
    return { ok: false, response: NextResponse.json({ error: SERVER_CARD_IMAGE_FAIL_KO }, { status: 500 }) };
  }
  if (!tournament) {
    return { ok: false, response: NextResponse.json({ error: "Tournament not found." }, { status: 404 }) };
  }
  const ownerId = await publisherTournamentOwnerId(publisher.user);
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== ownerId) {
    return { ok: false, response: NextResponse.json({ error: "You can publish only your tournaments." }, { status: 403 }) };
  }
  return { ok: true };
}

async function persistPngResponse(params: {
  png: Buffer;
  uploaderUserId: string;
}): Promise<NextResponse> {
  const imageId = randomUUID();
  const persist = await persistProofImageW320W640Variants({
    imageId,
    buffer: params.png,
    ext: "png",
    uploaderUserId: params.uploaderUserId,
    sitePublic: true,
    preservePngTransparency: true,
    flattenPublishedCardPng: true,
  });
  if (!persist.ok) {
    return NextResponse.json(
      { error: SERVER_CARD_IMAGE_FAIL_KO, ...(persist.code ? { code: persist.code } : {}) },
      { status: persist.status },
    );
  }

  if (tournamentImageDiagEnabled()) {
    console.info("[tournament-card-image] persisted urls", {
      w640Url: persist.w640Url,
      w320Url: persist.w320Url,
      originalUrl: persist.originalUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    imageId: persist.imageId,
    originalUrl: persist.originalUrl,
    publishedCardImageUrl: persist.w640Url,
    publishedCardImage320Url: persist.w320Url,
    publishedCardImage480Url: persist.w480Url ?? persist.w320Url,
    w1280Url: persist.originalUrl,
    w640Url: persist.w640Url,
    w480Url: persist.w480Url ?? persist.w320Url,
    w320Url: persist.w320Url,
  });
}

export async function POST(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }
  if (!isFirestoreUsersBackendConfigured() && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: SERVER_CARD_IMAGE_FAIL_KO }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: MULTIPART_ONLY_KO }, { status: 415 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }
  const tournamentId = asString(formData.get("tournamentId")).trim();
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
  }
  const accessMulti = await assertTournamentImageAccess({ publisher, tournamentId });
  if (!accessMulti.ok) return accessMulti.response;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PNG file is required." }, { status: 400 });
  }
  const mime = (file.type ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  if (!mime.includes("png") && !name.endsWith(".png")) {
    return NextResponse.json({ error: "Only PNG uploads are allowed for published card images." }, { status: 400 });
  }

  let png: Buffer;
  try {
    png = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: SERVER_CARD_IMAGE_FAIL_KO }, { status: 400 });
  }
  if (png.length < 100) {
    return NextResponse.json({ error: "Uploaded image is too small or empty." }, { status: 400 });
  }

  if (tournamentImageDiagEnabled()) {
    console.info("[tournament-card-image] png source: client-browser-upload", { bytes: png.length, tournamentId });
  }

  return persistPngResponse({ png, uploaderUserId: publisher.user.id });
}
