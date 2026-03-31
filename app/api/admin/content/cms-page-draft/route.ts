import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import type { PageSlug } from "@/types/page-section";
import { CmsDraftPublishValidationError } from "@/lib/content/cms-page-draft-normalize";
import {
  ensureDraftFromPublished,
  getCmsDraftMetaForPage,
  publishCmsPageLayoutDraft,
  resetCmsPageDraft,
} from "@/lib/content/service";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";

const BUILDER_PAGES: PageSlug[] = ["home", "community", "tournaments"];

function revalidatePublicForPage(page: PageSlug) {
  revalidatePath("/", "layout");
  if (page === "community") revalidatePath("/community", "layout");
  if (page === "tournaments") revalidatePath("/tournaments", "layout");
}

/** 초안 존재 여부·갱신 시각 (관리자 전용) */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") as PageBuilderKey | null;
  if (!page || !BUILDER_PAGES.includes(page)) {
    return NextResponse.json({ error: "page는 home, community, tournaments 중 하나여야 합니다." }, { status: 400 });
  }
  try {
    const meta = await getCmsDraftMetaForPage(page);
    return NextResponse.json(meta);
  } catch (e) {
    console.error("[cms-page-draft] GET error:", e);
    return NextResponse.json({ error: "상태를 불러오지 못했습니다." }, { status: 500 });
  }
}

type PostBody = { action: "publish" | "reset" | "ensureSave"; page: PageSlug };

/** publish | reset | ensureSave(공개본을 초안으로 복사, 이미 초안이면 noop) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const page = body.page;
  if (!page || !BUILDER_PAGES.includes(page)) {
    return NextResponse.json({ error: "page는 home, community, tournaments 중 하나여야 합니다." }, { status: 400 });
  }
  const pageKey = page as PageBuilderKey;

  try {
    if (body.action === "publish") {
      const result = await publishCmsPageLayoutDraft(pageKey);
      revalidatePublicForPage(pageKey);
      return NextResponse.json(result);
    }
    if (body.action === "reset") {
      await resetCmsPageDraft(pageKey);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "ensureSave") {
      const result = await ensureDraftFromPublished(pageKey);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
  } catch (e) {
    if (e instanceof CmsDraftPublishValidationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_DRAFT") {
      return NextResponse.json(
        { error: "저장된 초안이 없습니다. 먼저 편집하거나「초안 저장」을 눌러 주세요." },
        { status: 400 }
      );
    }
    console.error("[cms-page-draft] POST error:", e);
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}
