import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDatabaseUrlForDevelopment } from "@/lib/db-mode";
import { getSession } from "@/lib/auth";

const DB_ERROR_CODES = ["P1001", "P1002", "P1017", "P1033"];

function isDbConnectionError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    (typeof err?.code === "string" && DB_ERROR_CODES.includes(err.code)) ||
    (typeof err?.message === "string" &&
      /connect|ECONNREFUSED|timeout|database/i.test(err.message))
  );
}

/** GET: 플랫폼 관리자 — 클라이언트 신청 목록. Prisma 실패 시 raw SQL로 재시도 */
export async function GET() {
  ensureDatabaseUrlForDevelopment();
  let session;
  try {
    session = await getSession();
  } catch (e) {
    console.error("[admin/client-applications] getSession error:", e);
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const list = await prisma.clientApplication.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            status: true,
            withdrawnAt: true,
          },
        },
      },
    });
    return NextResponse.json(
      list.map((a) => ({
        ...a,
        requestedClientType: (a as { requestedClientType?: string | null }).requestedClientType ?? "GENERAL",
      }))
    );
  } catch (e) {
    console.error("[admin/client-applications] GET error:", e);
    if (process.env.NODE_ENV === "development" && isDbConnectionError(e)) {
      return NextResponse.json([]);
    }
    try {
      const rows = await prisma.$queryRawUnsafe<
        {
          id: string;
          type: string;
          status: string;
          requestedClientType: string | null;
          organizationName: string;
          applicantName: string;
          phone: string;
          email: string;
          region: string | null;
          shortDescription: string | null;
          referenceLink: string | null;
          rejectedReason: string | null;
          reviewedAt: Date | null;
          createdAt: Date;
          applicantUserId: string | null;
          uId: string | null;
          uName: string | null;
          uUsername: string | null;
          uEmail: string | null;
          uStatus: string | null;
          uWithdrawnAt: Date | null;
        }[]
      >(
        `SELECT a.id, a.type, a.status, a."requestedClientType", a."organizationName", a."applicantName", a.phone, a.email,
                a.region, a."shortDescription", a."referenceLink", a."rejectedReason", a."reviewedAt",
                a."createdAt", a."applicantUserId",
                u.id AS "uId", u.name AS "uName", u.username AS "uUsername", u.email AS "uEmail",
                u.status AS "uStatus", u."withdrawnAt" AS "uWithdrawnAt"
         FROM "ClientApplication" a
         LEFT JOIN "User" u ON u.id = a."applicantUserId"
         ORDER BY a."createdAt" DESC`
      );
      const list = rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        requestedClientType: r.requestedClientType ?? "GENERAL",
        organizationName: r.organizationName,
        applicantName: r.applicantName,
        phone: r.phone,
        email: r.email,
        region: r.region,
        shortDescription: r.shortDescription,
        referenceLink: r.referenceLink,
        rejectedReason: r.rejectedReason,
        reviewedAt: r.reviewedAt != null ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        applicant:
          r.uId != null
            ? {
                id: r.uId,
                name: r.uName ?? "",
                username: r.uUsername ?? "",
                email: r.uEmail ?? "",
                status: r.uStatus ?? null,
                withdrawnAt: r.uWithdrawnAt != null ? r.uWithdrawnAt.toISOString() : null,
              }
            : null,
      }));
      return NextResponse.json(list);
    } catch (rawErr) {
      console.error("[admin/client-applications] GET raw fallback error:", rawErr);
      if (process.env.NODE_ENV === "development" && isDbConnectionError(rawErr)) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: "목록을 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  }
}
