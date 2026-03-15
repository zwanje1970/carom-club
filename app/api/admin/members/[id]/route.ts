import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ALLOWED_ROLES = ["USER", "CLIENT_ADMIN", "PLATFORM_ADMIN", "ZONE_MANAGER"] as const;
const ALLOWED_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;

/**
 * PATCH: 플랫폼 관리자 — 회원 권한/상태 변경
 * body: { role?: string, status?: string }
 * 클라이언트 등급(org clientType/approvalStatus)은 별도 API 또는 body 확장으로 처리 가능.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "사용자 ID가 필요합니다." }, { status: 400 });
    }

    let body: { role?: string; status?: string; orgClientType?: string; orgApprovalStatus?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const updates: { role?: (typeof ALLOWED_ROLES)[number]; status?: string | null } = {};
    if (body.role !== undefined) {
      if (!ALLOWED_ROLES.includes(body.role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "허용되지 않은 구분(role)입니다." }, { status: 400 });
      }
      updates.role = body.role as (typeof ALLOWED_ROLES)[number];
    }
    if (body.status !== undefined) {
      if (body.status !== null && !ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])) {
        return NextResponse.json({ error: "허용되지 않은 상태입니다." }, { status: 400 });
      }
      updates.status = body.status === "" || body.status === null ? null : body.status;
    }

    const orgUpdates: { clientType?: string; approvalStatus?: string } = {};
    if (body.orgClientType !== undefined && ["GENERAL", "REGISTERED"].includes(body.orgClientType)) {
      orgUpdates.clientType = body.orgClientType;
    }
    if (body.orgApprovalStatus !== undefined && ["PENDING", "APPROVED", "REJECTED"].includes(body.orgApprovalStatus)) {
      orgUpdates.approvalStatus = body.orgApprovalStatus;
    }

    if (Object.keys(updates).length === 0 && Object.keys(orgUpdates).length === 0) {
      return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id },
        data: updates,
      });
    }
    if (Object.keys(orgUpdates).length > 0) {
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: id },
      });
      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: orgUpdates,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/members] PATCH error:", e);
    return NextResponse.json(
      { error: "변경을 적용할 수 없습니다." },
      { status: 500 }
    );
  }
}
