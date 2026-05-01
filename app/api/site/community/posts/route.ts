import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { CACHE_TAG_SITE_PUBLIC_COMMUNITY_FEED } from "../../../../../lib/cache-tags";
import { revalidateSiteDataTag } from "../../../../../lib/revalidate-site-data-tag";
import {
  createCommunityPost,
  getUserById,
  listCommunityPosts,
  parseCommunityBoardTypeParam,
} from "../../../../../lib/platform-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const boardType = parseCommunityBoardTypeParam(url.searchParams.get("boardType") ?? "");
  if (!boardType) {
    return NextResponse.json({ error: "boardType이 필요합니다." }, { status: 400 });
  }
  const items = await listCommunityPosts(boardType);
  return NextResponse.json({ boardType, items });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(rawCookie);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { boardType?: unknown; title?: unknown; content?: unknown; imageUrls?: unknown; imageSizeLevels?: unknown } =
    {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const boardType = parseCommunityBoardTypeParam(typeof body.boardType === "string" ? body.boardType : "");
  if (!boardType) {
    return NextResponse.json({ error: "boardType이 올바르지 않습니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";

  const result = await createCommunityPost({
    boardType,
    title,
    content,
    imageUrls: body.imageUrls,
    imageSizeLevels: body.imageSizeLevels,
    authorUserId: user.id,
    authorNickname: user.nickname,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  revalidateSiteDataTag(CACHE_TAG_SITE_PUBLIC_COMMUNITY_FEED);

  return NextResponse.json({ ok: true, id: result.post.id });
}
