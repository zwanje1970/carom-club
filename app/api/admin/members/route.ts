import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type MemberRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: string | null;
  withdrawnAt: string | null;
  createdAt: string;
};

/**
 * GET: 플랫폼 관리자 — 회원 목록 (탈퇴 회원 포함, 필터 가능)
 * query: filter = all | active | withdrawn (default: active)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "active"; // all | active | withdrawn

    if (filter === "active") {
      // 정상: 탈퇴하지 않은 회원 (withdrawnAt이 null)
      const rows = await prisma.user.findMany({
        where: { withdrawnAt: null },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          withdrawnAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          role: u.role,
          status: u.status ?? "ACTIVE",
          withdrawnAt: u.withdrawnAt ? u.withdrawnAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        }))
      );
    }
    if (filter === "withdrawn") {
      const rows = await prisma.user.findMany({
        where: { withdrawnAt: { not: null } },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          withdrawnAt: true,
          createdAt: true,
        },
        orderBy: { withdrawnAt: "desc" },
      });
      return NextResponse.json(
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          role: u.role,
          status: u.status ?? "DELETED",
          withdrawnAt: u.withdrawnAt ? u.withdrawnAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        }))
      );
    }

    // all
    const rows = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        withdrawnAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status ?? (u.withdrawnAt ? "DELETED" : "ACTIVE"),
        withdrawnAt: u.withdrawnAt ? u.withdrawnAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[admin/members] GET error:", e);
    return NextResponse.json(
      { error: "회원 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
