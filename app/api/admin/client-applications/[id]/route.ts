import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { nameToSlug, ensureUniqueSlug } from "@/lib/slug";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

/** PATCH: 상태 변경 (PENDING | APPROVED | REJECTED). 승인/거절 후 되돌리기 및 재변경 가능 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await _request.json();
    const { status, rejectedReason } = body as {
      status?: "PENDING" | "APPROVED" | "REJECTED";
      rejectedReason?: string;
    };
    const reviewedByUserId = session.id;

    if (status !== "PENDING" && status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json(
        { error: "status는 PENDING, APPROVED, REJECTED 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    const app = await prisma.clientApplication.findUnique({
      where: { id },
      include: { applicant: true },
    });
    if (!app) {
      return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date();
    const applicantId = app.applicantUserId;

    // --- PENDING: 보류로 되돌리기 (거절사유 초기화) ---
    if (status === "PENDING") {
      await prisma.clientApplication.update({
        where: { id },
        data: {
          status: "PENDING",
          rejectedReason: null,
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      return NextResponse.json({ ok: true, status: "PENDING" });
    }

    // --- REJECTED: 거절 (거절사유 저장/수정/삭제) ---
    if (status === "REJECTED") {
      const reason = rejectedReason !== undefined ? (rejectedReason?.trim() || null) : app.rejectedReason;
      await prisma.clientApplication.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedReason: reason,
          reviewedAt: now,
          reviewedByUserId,
        },
      });
      if (applicantId) {
        const msg = reason
          ? `클라이언트 신청이 거절되었습니다.\n사유: ${reason}`
          : "클라이언트 신청이 거절되었습니다.";
        await prisma.notification.create({
          data: { userId: applicantId, message: msg },
        });
      }
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    // --- APPROVED: 승인 (rejectReason null 처리). 최초 승인 시에만 업체 생성 ---
    if (!applicantId || !app.applicant) {
      return NextResponse.json(
        { error: "승인하려면 신청자가 로그인 회원이어야 합니다. 신청자에게 회원가입 후 재신청을 요청해 주세요." },
        { status: 400 }
      );
    }

    const existingOrg = await prisma.organization.findFirst({
      where: { ownerUserId: applicantId },
    });

    const requestedType = (app as { requestedClientType?: string | null }).requestedClientType ?? "GENERAL";
    const annualMembershipVisible = await isAnnualMembershipVisible();
    if (status === "APPROVED" && requestedType === "REGISTERED" && !annualMembershipVisible) {
      return NextResponse.json({ error: "연회원 기능이 비활성화되어 있습니다." }, { status: 404 });
    }
    const orgClientType = requestedType === "REGISTERED" ? "REGISTERED" : "GENERAL";
    const orgMembershipType = requestedType === "REGISTERED" ? "ANNUAL" : "NONE";

    if (existingOrg) {
      // 이미 업체가 있음: 신청만 APPROVED로 갱신하고 organization 등급 반영 + 소유자 멤버 행 보장
      await prisma.$transaction(async (tx) => {
        await tx.clientApplication.update({
          where: { id },
          data: { status: "APPROVED", rejectedReason: null, reviewedAt: now, reviewedByUserId },
        });
        await tx.organization.update({
          where: { id: existingOrg.id },
          data: {
            clientType: orgClientType,
            approvalStatus: "APPROVED",
            membershipType: orgMembershipType,
          },
        });
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: { organizationId: existingOrg.id, userId: applicantId },
          },
          create: {
            organizationId: existingOrg.id,
            userId: applicantId,
            role: "OWNER",
            status: "ACTIVE",
          },
          update: { status: "ACTIVE", role: "OWNER" },
        });
      });
      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    const baseSlug = nameToSlug(app.organizationName);
    const slug = await ensureUniqueSlug(baseSlug, (s) =>
      prisma.organization.findUnique({ where: { slug: s } }).then(Boolean)
    );

    await prisma.$transaction(async (tx) => {
      const applicant = app.applicant as { address?: string | null; addressDetail?: string | null } | null;
      const org = await tx.organization.create({
        data: {
          ownerUserId: applicantId,
          slug,
          name: app.organizationName,
          type: app.type,
          shortDescription: app.shortDescription,
          description: app.shortDescription,
          phone: app.phone,
          email: app.email,
          region: app.region,
          address: applicant?.address?.trim() || null,
          addressDetail: applicant?.addressDetail?.trim() || null,
          isPublished: false,
          setupCompleted: false,
          clientType: orgClientType,
          approvalStatus: "APPROVED",
          membershipType: orgMembershipType,
        },
      });

      await tx.user.update({
        where: { id: applicantId },
        data: { role: "CLIENT_ADMIN" },
      });

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: org.id, userId: applicantId },
        },
        create: {
          organizationId: org.id,
          userId: applicantId,
          role: "OWNER",
          status: "ACTIVE",
        },
        update: { status: "ACTIVE" },
      });

      await tx.clientApplication.update({
        where: { id },
        data: { status: "APPROVED", rejectedReason: null, reviewedAt: now, reviewedByUserId },
      });

      await tx.notification.create({
        data: {
          userId: applicantId,
          message: `클라이언트 신청이 승인되었습니다. "${app.organizationName}" 업체가 생성되었습니다. 클라이언트 대시보드에서 설정을 완료해 주세요.`,
        },
      });
    });

    return NextResponse.json({ ok: true, status: "APPROVED" });
  } catch (e) {
    console.error("[admin/client-applications] PATCH error:", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
