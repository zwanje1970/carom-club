import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminCopy, updateAdminCopy } from "@/lib/admin-copy-server";
import {
  DEFAULT_SITE_CARD_STYLE,
  parseSiteCardStyle,
  SITE_CARD_STYLE_COPY_KEYS,
  toSiteCardStyleCopy,
  type SiteCardStyle,
} from "@/lib/site-card-style";

function parseBody(input: unknown): SiteCardStyle | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  const shape = body.shape === "circle" ? "circle" : body.shape === "square" ? "square" : null;
  const style = body.style === "flat" || body.style === "border" || body.style === "shadow" ? body.style : null;
  const thumbFit = body.thumbFit === "cover" || body.thumbFit === "contain" ? body.thumbFit : null;
  const linkMode = body.linkMode === "block" || body.linkMode === "button" ? body.linkMode : null;
  const width = Number(body.width);
  const height = Number(body.height);
  const radius = Number(body.radius);
  if (!shape || !style || !thumbFit || !linkMode) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(radius)) return null;
  return {
    shape,
    style,
    thumbFit,
    linkMode,
    width: Math.min(1200, Math.max(120, Math.floor(width))),
    height: Math.min(1200, Math.max(80, Math.floor(height))),
    radius: Math.min(999, Math.max(0, Math.floor(radius))),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const copy = await getAdminCopy(SITE_CARD_STYLE_COPY_KEYS);
    return NextResponse.json(parseSiteCardStyle(copy));
  } catch {
    return NextResponse.json(DEFAULT_SITE_CARD_STYLE);
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "카드 설정 값이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    await updateAdminCopy(toSiteCardStyleCopy(parsed));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "카드 설정 저장에 실패했습니다." }, { status: 500 });
  }
}
