import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getCardSnapshotById,
  getClientStatusByUserId,
  getUserById,
  listCardSnapshotsByVenueId,
  publishVenueCardSnapshot,
  setCardSnapshotActive,
} from "../../../../lib/server/dev-store";
import { isSupportedVenueId } from "../../../../lib/venues/catalog";

export const runtime = "nodejs";

async function getPublisher() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
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

export async function POST(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  let body: {
    venueId?: unknown;
    templateType?: unknown;
    title?: unknown;
    subtitle?: unknown;
    imageId?: unknown;
    image320Url?: unknown;
    image640Url?: unknown;
    textLayout?: unknown;
    imageLayout?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const venueId = typeof body.venueId === "string" ? body.venueId : "";
  if (!isSupportedVenueId(venueId)) {
    return NextResponse.json({ error: "지원하지 않는 당구장 ID입니다." }, { status: 400 });
  }
  const result = await publishVenueCardSnapshot({
    venueId,
    templateId: "main-card-template-venue",
    templateType: "venue",
    title: typeof body.title === "string" ? body.title : "",
    subtitle: typeof body.subtitle === "string" ? body.subtitle : "",
    imageId: typeof body.imageId === "string" ? body.imageId : "",
    image320Url: typeof body.image320Url === "string" ? body.image320Url : "",
    image640Url: typeof body.image640Url === "string" ? body.image640Url : "",
    textLayout: typeof body.textLayout === "string" ? body.textLayout : "상단 제목 + 하단 보조문구",
    imageLayout: typeof body.imageLayout === "string" ? body.imageLayout : "고정 레이아웃",
    publishedBy: publisher.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}

export async function GET(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  const url = new URL(request.url);
  const venueId = url.searchParams.get("venueId") ?? "";
  if (!venueId || !isSupportedVenueId(venueId)) {
    return NextResponse.json({ error: "유효한 venueId가 필요합니다." }, { status: 400 });
  }

  const snapshots = await listCardSnapshotsByVenueId(venueId);
  const activeSnapshot = snapshots.find((item) => item.isActive) ?? null;
  return NextResponse.json({ snapshots, activeSnapshot });
}

export async function PATCH(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  let body: {
    snapshotId?: unknown;
    isActive?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : null;
  if (!snapshotId || isActive == null) {
    return NextResponse.json({ error: "snapshotId and isActive are required." }, { status: 400 });
  }

  const snapshot = await getCardSnapshotById(snapshotId);
  if (!snapshot || snapshot.snapshotSourceType !== "VENUE_SNAPSHOT") {
    return NextResponse.json({ error: "Venue snapshot not found." }, { status: 404 });
  }

  const result = await setCardSnapshotActive({ snapshotId, isActive });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}
