import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDatabaseUrlForDevelopment } from "@/lib/db-mode";
import { nameToSlug } from "@/lib/slug";

const CLIENT_ORG_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;

/** PATCH: 플랫폼 관리자 — 클라이언트 권한 정지/복원/제명, 비고, slug 수정 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { status, adminRemarks, slug: slugInput } = body as {
      status?: "ACTIVE" | "SUSPENDED" | "EXPELLED";
      adminRemarks?: string | null;
      slug?: string | null;
    };
    const org = await prisma.organization.findFirst({
      where: { id, type: { in: [...CLIENT_ORG_TYPES] } },
    });
    if (!org) {
      return NextResponse.json({ error: "클라이언트를 찾을 수 없습니다." }, { status: 404 });
    }
    const data: { status?: string; adminRemarks?: string | null; slug?: string | null } = {};
    if (status === "ACTIVE" || status === "SUSPENDED" || status === "EXPELLED") data.status = status;
    if (adminRemarks !== undefined) data.adminRemarks = adminRemarks === "" ? null : adminRemarks;
    if (slugInput !== undefined) {
      const slugValue = slugInput === null || slugInput === "" ? null : nameToSlug(slugInput);
      if (slugValue === "org") {
        return NextResponse.json({ error: "slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다." }, { status: 400 });
      }
      if (slugValue) {
        const existing = await prisma.organization.findUnique({ where: { slug: slugValue } });
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: "이미 사용 중인 slug입니다." }, { status: 400 });
        }
      }
      data.slug = slugValue;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }
    await prisma.organization.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/venues] PATCH error:", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/** DELETE: 플랫폼 관리자 — 당구장(업체) 삭제. P2022 회피를 위해 조회·삭제 모두 raw SQL 사용 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureDatabaseUrlForDevelopment();
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  let orgExists = false;
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Organization" WHERE id = $1 AND type = 'VENUE'`,
      id
    );
    orgExists = rows.length > 0;
  } catch (e) {
    console.error("[admin/venues] DELETE check org error:", e);
    return NextResponse.json(
      { error: "당구장 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
  if (!orgExists) {
    return NextResponse.json({ error: "당구장을 찾을 수 없습니다." }, { status: 404 });
  }

  /** 테이블이 없거나 컬럼이 없어도 무시 (스키마 차이 대응) */
  async function runDelete(
    tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
    sql: string,
    ...params: unknown[]
  ): Promise<void> {
    try {
      await tx.$executeRawUnsafe(sql, ...params);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2022" || (typeof err.message === "string" && /does not exist|relation|column/i.test(err.message))) {
        return;
      }
      throw e;
    }
  }

  /** PostgreSQL: IN ($1, $2, ...) 형태로 배열 삭제 */
  function deleteIn(tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">, table: string, column: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    return runDelete(tx, `DELETE FROM "${table}" WHERE "${column}" IN (${placeholders})`, ...ids);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tournamentIds = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Tournament" WHERE "organizationId" = $1`,
        id
      ).catch(() => [] as { id: string }[]);
      const tIds = tournamentIds.map((r) => r.id);

      if (tIds.length > 0) {
        const entryRows = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "TournamentEntry" WHERE "tournamentId" IN (${tIds.map((_, i) => `$${i + 1}`).join(", ")})`,
          ...tIds
        ).catch(() => [] as { id: string }[]);
        const entryIds = entryRows.map((r) => r.id);
        if (entryIds.length > 0) {
          await deleteIn(tx, "TournamentAttendance", "entryId", entryIds);
        }
        await deleteIn(tx, "TournamentEntry", "tournamentId", tIds);

        const roundRows = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "TournamentRound" WHERE "tournamentId" IN (${tIds.map((_, i) => `$${i + 1}`).join(", ")})`,
          ...tIds
        ).catch(() => [] as { id: string }[]);
        const roundIds = roundRows.map((r) => r.id);
        if (roundIds.length > 0) {
          const groupRows = await tx.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM "TournamentGroup" WHERE "roundId" IN (${roundIds.map((_, i) => `$${i + 1}`).join(", ")})`,
            ...roundIds
          ).catch(() => [] as { id: string }[]);
          const groupIds = groupRows.map((r) => r.id);
          if (groupIds.length > 0) {
            await deleteIn(tx, "TournamentGroupMember", "groupId", groupIds);
            await deleteIn(tx, "TournamentResult", "groupId", groupIds);
            await deleteIn(tx, "TournamentGroup", "roundId", roundIds);
          }
          await deleteIn(tx, "TournamentRound", "tournamentId", tIds);
        }

        await deleteIn(tx, "TournamentRule", "tournamentId", tIds);
        await runDelete(tx, `DELETE FROM "Tournament" WHERE "organizationId" = $1`, id);
      }

      await runDelete(tx, `DELETE FROM "OrganizationMember" WHERE "organizationId" = $1`, id);
      await tx.$executeRawUnsafe(`DELETE FROM "Organization" WHERE id = $1`, id);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/venues] DELETE error:", e);
    const err = e as { code?: string; message?: string };
    const msg =
      process.env.NODE_ENV === "development" && err.message
        ? String(err.message)
        : "삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
