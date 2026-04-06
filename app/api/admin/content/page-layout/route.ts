import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  duplicatePageSection,
  getPageSectionByIdForAdmin,
  getPageSectionsForAdminLayoutPage,
  movePageSectionToPage,
  restorePageSection,
  setPageSectionOrderForPage,
  softDeletePageSection,
  updatePageSectionStructure,
  updatePageSectionVisibility,
} from "@/lib/content/service";
import { pageNotAllowedMessage } from "@/lib/content/page-section-page-rules";
import { coerceSlotBlockCardStyle, resolveSlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { coerceSlotBlockCtaConfig } from "@/lib/slot-block-cta";
import { coerceSlotBlockLayout, coerceSlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { coerceSlotBlockTournamentListSettings } from "@/lib/slot-block-tournament-list";
import { parseSectionStyleJson } from "@/lib/section-style";
import type { PageSlug, PlacementSlug } from "@/types/page-section";

const BUILDER_PAGES: PageSlug[] = ["home", "community", "tournaments"];

/** 관리자: 페이지별 섹션 전체 목록(빌더용) */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") as PageSlug | null;
  if (!page || !BUILDER_PAGES.includes(page)) {
    return NextResponse.json({ error: "page는 home, community, tournaments 중 하나여야 합니다." }, { status: 400 });
  }
  try {
    const list = await getPageSectionsForAdminLayoutPage(page);
    return NextResponse.json(list);
  } catch (e) {
    console.error("[content/page-layout] GET error:", e);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

const PLACEMENTS: PlacementSlug[] = [
  "below_header",
  "main_visual_bg",
  "below_main_copy",
  "above_content",
  "content_middle",
  "content_bottom",
];

function mapSectionLayoutError(e: unknown): { status: number; message: string } {
  const msg = e instanceof Error ? e.message : "";
  switch (msg) {
    case "NOT_FOUND":
      return { status: 404, message: "해당 섹션을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." };
    case "PAGE_SECTION_PAGE_NOT_ALLOWED":
      return { status: 400, message: pageNotAllowedMessage() };
    case "INVALID_TARGET_PAGE":
      return { status: 400, message: "이 섹션은 선택한 페이지에 둘 수 없습니다. 홈·커뮤니티·대회 중 허용된 페이지만 선택해 주세요." };
    case "SAME_PAGE":
      return { status: 400, message: "이미 이 페이지에 있는 섹션입니다. 다른 페이지를 선택해 주세요." };
    case "INVALID_PLACEMENT":
      return { status: 400, message: "지원하지 않는 노출 위치입니다. 다시 선택해 주세요." };
    default:
      return { status: 500, message: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요." };
  }
}

type PatchBody =
  | { action: "reorder"; page: PageSlug; orderedIds: string[] }
  | { action: "visibility"; id: string; isVisible: boolean }
  | { action: "moveSection"; id: string; targetPage: PageSlug }
  | { action: "duplicateSection"; id: string; targetPage: PageSlug }
  | { action: "softDeleteSection"; id: string }
  | { action: "restoreSection"; id: string }
  | {
      action: "updateStructure";
      id: string;
      placement?: PlacementSlug;
      startAt?: string | null;
      endAt?: string | null;
      /** 홈 구조 슬롯 카드 스타일 — `sectionStyleJson.slotBlockCard`에 병합 */
      slotBlockCard?: Record<string, unknown>;
      slotBlockCta?: Record<string, unknown>;
      slotBlockLayout?: Record<string, unknown>;
      slotBlockMotion?: Record<string, unknown>;
      slotBlockTournamentList?: Record<string, unknown>;
      /** `sectionStyleJson.backgroundColor` (블록 배경) */
      backgroundColor?: string | null;
      /** 직접 구성 카드 등 — 객체·배열만 허용, null이면 필드 제거 */
      slotBlockItems?: Record<string, unknown> | unknown[] | null;
    };

/** 순서 저장 · 표시 토글 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.action === "reorder") {
    const { page, orderedIds } = body;
    if (!page || !BUILDER_PAGES.includes(page) || !Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: "페이지와 순서 배열(orderedIds)이 올바르게 전달되지 않았습니다." },
        { status: 400 }
      );
    }
    try {
      await setPageSectionOrderForPage(page, orderedIds);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "PAGE_LAYOUT_ORDER_MISMATCH") {
        return NextResponse.json(
          { error: "목록이 변경되었습니다. 새로고침 후 다시 시도하세요." },
          { status: 409 }
        );
      }
      console.error("[content/page-layout] reorder error:", e);
      return NextResponse.json({ error: "순서 저장에 실패했습니다." }, { status: 500 });
    }
  }

  if (body.action === "visibility") {
    const { id, isVisible } = body;
    if (!id?.trim() || typeof isVisible !== "boolean") {
      return NextResponse.json({ error: "id, isVisible(boolean)가 필요합니다." }, { status: 400 });
    }
    try {
      const updated = await updatePageSectionVisibility(id.trim(), isVisible);
      if (!updated) {
        return NextResponse.json({ error: "섹션을 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (e) {
      console.error("[content/page-layout] visibility error:", e);
      return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
    }
  }

  if (body.action === "moveSection") {
    const { id, targetPage } = body;
    if (!id?.trim() || !targetPage || !BUILDER_PAGES.includes(targetPage)) {
      return NextResponse.json({ error: "id, targetPage가 필요합니다." }, { status: 400 });
    }
    try {
      const updated = await movePageSectionToPage(id.trim(), targetPage);
      return NextResponse.json(updated);
    } catch (e) {
      const m = mapSectionLayoutError(e);
      if (m.status >= 500) console.error("[content/page-layout] moveSection error:", e);
      return NextResponse.json({ error: m.message }, { status: m.status });
    }
  }

  if (body.action === "duplicateSection") {
    const { id, targetPage } = body;
    if (!id?.trim() || !targetPage || !BUILDER_PAGES.includes(targetPage)) {
      return NextResponse.json(
        { error: "섹션 id와 복제할 페이지(targetPage)를 확인해 주세요." },
        { status: 400 }
      );
    }
    try {
      const created = await duplicatePageSection(id.trim(), targetPage);
      return NextResponse.json(created);
    } catch (e) {
      const m = mapSectionLayoutError(e);
      if (m.status >= 500) console.error("[content/page-layout] duplicateSection error:", e);
      return NextResponse.json({ error: m.message }, { status: m.status });
    }
  }

  if (body.action === "softDeleteSection") {
    const { id } = body;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    try {
      const updated = await softDeletePageSection(id.trim());
      if (!updated) {
        return NextResponse.json({ error: "섹션을 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (e) {
      console.error("[content/page-layout] softDeleteSection error:", e);
      return NextResponse.json({ error: "삭제 처리에 실패했습니다." }, { status: 500 });
    }
  }

  if (body.action === "restoreSection") {
    const { id } = body;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    try {
      const updated = await restorePageSection(id.trim());
      if (!updated) {
        return NextResponse.json({ error: "섹션을 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (e) {
      console.error("[content/page-layout] restoreSection error:", e);
      return NextResponse.json({ error: "복원에 실패했습니다." }, { status: 500 });
    }
  }

  if (body.action === "updateStructure") {
    const {
      id,
      placement,
      startAt,
      endAt,
      slotBlockCard,
      slotBlockCta,
      slotBlockLayout,
      slotBlockMotion,
      slotBlockTournamentList,
      backgroundColor,
      slotBlockItems,
    } = body;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    if (placement !== undefined && !PLACEMENTS.includes(placement)) {
      return NextResponse.json({ error: "유효하지 않은 placement입니다." }, { status: 400 });
    }
    try {
      const existing = await getPageSectionByIdForAdmin(id.trim());
      if (!existing) {
        return NextResponse.json({ error: "섹션을 찾을 수 없습니다." }, { status: 404 });
      }
      const patch: {
        placement?: PlacementSlug;
        startAt?: string | null;
        endAt?: string | null;
        sectionStyleJson?: string | null;
      } = { placement, startAt, endAt };
      if (
        slotBlockCard !== undefined ||
        slotBlockCta !== undefined ||
        slotBlockLayout !== undefined ||
        slotBlockMotion !== undefined ||
        slotBlockTournamentList !== undefined ||
        backgroundColor !== undefined ||
        slotBlockItems !== undefined
      ) {
        const nextJson = { ...parseSectionStyleJson(existing.sectionStyleJson) };
        if (slotBlockCard !== undefined) {
          nextJson.slotBlockCard = coerceSlotBlockCardStyle(
            existing.slotType,
            slotBlockCard
          ) as unknown as Record<string, unknown>;
        }
        if (slotBlockCta !== undefined) {
          nextJson.slotBlockCta = coerceSlotBlockCtaConfig(
            existing.slotType,
            slotBlockCta
          ) as unknown as Record<string, unknown>;
        }
        const cardForLayout = resolveSlotBlockCardStyle(
          existing.slotType,
          JSON.stringify(nextJson)
        );
        if (slotBlockLayout !== undefined) {
          nextJson.slotBlockLayout = coerceSlotBlockLayout(
            slotBlockLayout,
            cardForLayout
          ) as unknown as Record<string, unknown>;
        }
        if (slotBlockMotion !== undefined) {
          nextJson.slotBlockMotion = coerceSlotBlockMotion(
            slotBlockMotion
          ) as unknown as Record<string, unknown>;
        }
        if (slotBlockTournamentList !== undefined) {
          nextJson.slotBlockTournamentList = coerceSlotBlockTournamentListSettings(
            slotBlockTournamentList
          ) as unknown as Record<string, unknown>;
        }
        if (backgroundColor !== undefined) {
          const t = typeof backgroundColor === "string" ? backgroundColor.trim() : "";
          if (t) nextJson.backgroundColor = t;
          else delete nextJson.backgroundColor;
        }
        if (slotBlockItems !== undefined) {
          if (slotBlockItems === null) {
            delete nextJson.slotBlockItems;
          } else if (typeof slotBlockItems === "object") {
            nextJson.slotBlockItems = slotBlockItems;
          }
        }
        patch.sectionStyleJson = JSON.stringify(nextJson);
      }
      const updated = await updatePageSectionStructure(id.trim(), patch);
      if (!updated) {
        return NextResponse.json({ error: "섹션을 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (e) {
      const m = mapSectionLayoutError(e);
      if (m.status >= 500) console.error("[content/page-layout] updateStructure error:", e);
      return NextResponse.json({ error: m.message }, { status: m.status });
    }
  }

  return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
}
