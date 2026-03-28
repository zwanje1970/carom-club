import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// .env 에 SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD 설정 시 사용. 없으면 아래 기본값.
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

// 대진표 테스트용 회원 64명 공통 비밀번호
const TEST_USER_PASSWORD = process.env.SEED_TEST_USER_PASSWORD ?? "test1234";

const RBAC_PERMISSIONS = [
  { key: "community.post.create", label: "커뮤니티 글 작성", category: "community", description: "커뮤니티 게시글 작성" },
  { key: "community.post.edit.own", label: "내 글 수정", category: "community", description: "본인 게시글 수정" },
  { key: "community.post.delete.own", label: "내 글 삭제", category: "community", description: "본인 게시글 삭제" },
  { key: "community.comment.create", label: "댓글 작성", category: "community", description: "커뮤니티 댓글 작성" },
  { key: "community.comment.edit.own", label: "내 댓글 수정", category: "community", description: "본인 댓글 수정" },
  { key: "community.comment.delete.own", label: "내 댓글 삭제", category: "community", description: "본인 댓글 삭제" },
  { key: "community.vote.like", label: "추천/좋아요", category: "community", description: "게시글/댓글 추천" },
  { key: "solver.solution.view", label: "해법 조회", category: "solver", description: "난구해결사 해법 조회" },
  { key: "solver.solution.create", label: "해법 작성", category: "solver", description: "난구해결사 해법 작성" },
  { key: "solver.solution.edit.own", label: "내 해법 수정", category: "solver", description: "본인 해법 수정" },
  { key: "solver.solution.delete.own", label: "내 해법 삭제", category: "solver", description: "본인 해법 삭제" },
  { key: "solver.solution.good", label: "해법 GOOD", category: "solver", description: "해법 GOOD 평가" },
  { key: "solver.solution.bad", label: "해법 BAD", category: "solver", description: "해법 BAD 평가" },
  { key: "solver.solution.accept", label: "해법 채택", category: "solver", description: "질문자의 해법 채택" },
  { key: "note.use", label: "당구노트 사용", category: "note", description: "당구노트 사용" },
  { key: "note.send_to_solver", label: "노트에서 난구해결로 보내기", category: "note", description: "노트를 난구해결사로 전송" },
  { key: "admin.access", label: "관리자 접근", category: "admin", description: "관리자 콘솔 접근" },
  { key: "admin.user.manage", label: "회원 관리", category: "admin", description: "회원 레벨/상태 관리" },
  { key: "admin.role.manage", label: "레벨(Role) 관리", category: "admin", description: "역할 조회/관리" },
  { key: "admin.permission.manage", label: "권한 관리", category: "admin", description: "레벨별 권한 저장" },
  { key: "admin.post.delete.any", label: "게시글 임의 삭제", category: "admin", description: "모든 게시글 삭제" },
  { key: "admin.solution.delete.any", label: "해법 임의 삭제", category: "admin", description: "모든 해법 삭제" },
  { key: "admin.user.ban", label: "회원 차단", category: "admin", description: "회원 정지/차단" },
] as const;

const ALL_RBAC_PERMISSION_KEYS = RBAC_PERMISSIONS.map((permission) => permission.key);

const USER_ROLE_PERMISSION_KEYS = [
  "community.post.create",
  "community.post.edit.own",
  "community.post.delete.own",
  "community.comment.create",
  "community.comment.edit.own",
  "community.comment.delete.own",
  "community.vote.like",
  "solver.solution.view",
  "solver.solution.create",
  "solver.solution.edit.own",
  "solver.solution.delete.own",
  "solver.solution.good",
  "solver.solution.bad",
] as const;

const NOTE_USER_ROLE_PERMISSION_KEYS = [
  ...USER_ROLE_PERMISSION_KEYS,
  "note.use",
  "note.send_to_solver",
  "solver.solution.accept",
] as const;

const SOLVER_ROLE_PERMISSION_KEYS = [...USER_ROLE_PERMISSION_KEYS] as const;

const RBAC_ROLES = [
  { key: "USER", label: "일반회원", description: "기본 커뮤니티/해법 작성 권한", permissionKeys: USER_ROLE_PERMISSION_KEYS },
  { key: "NOTE_USER", label: "당구노트 사용자", description: "당구노트와 채택 권한 포함", permissionKeys: NOTE_USER_ROLE_PERMISSION_KEYS },
  { key: "SOLVER", label: "해결사", description: "표시용 확장 역할, 1차는 USER와 동일 권한", permissionKeys: SOLVER_ROLE_PERMISSION_KEYS },
  { key: "ADMIN", label: "관리자", description: "모든 권한 허용", permissionKeys: ALL_RBAC_PERMISSION_KEYS },
] as const;

async function seedRbac() {
  for (const permission of RBAC_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: {
        key: permission.key,
        label: permission.label,
        category: permission.category,
      },
      update: {
        label: permission.label,
        category: permission.category,
      },
    });
  }

  await Promise.all(
    RBAC_PERMISSIONS.map((permission) =>
      prisma.$executeRaw`
        UPDATE "Permission"
        SET "label" = ${permission.label}, "category" = ${permission.category}
        WHERE "key" = ${permission.key}
      `
    )
  );

  for (const role of RBAC_ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        label: role.label,
        description: role.description ?? null,
        isSystem: true,
      },
      update: {
        label: role.label,
        description: role.description ?? null,
        isSystem: true,
      },
    });
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { key: { in: RBAC_ROLES.map((role) => role.key) } },
      select: { id: true, key: true },
    }),
    prisma.permission.findMany({
      where: { key: { in: ALL_RBAC_PERMISSION_KEYS } },
      select: { id: true, key: true },
    }),
  ]);

  const roleIdByKey = new Map(roles.map((role) => [role.key, role.id]));
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  for (const role of RBAC_ROLES) {
    const roleId = roleIdByKey.get(role.key);
    if (!roleId) continue;

    const targetPermissionIds = role.permissionKeys
      .map((permissionKey) => permissionIdByKey.get(permissionKey))
      .filter((permissionId): permissionId is string => typeof permissionId === "string");

    const existingRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });

    const existingPermissionIds = new Set(existingRolePermissions.map((item) => item.permissionId));
    const targetPermissionIdSet = new Set(targetPermissionIds);
    const permissionIdsToAdd = targetPermissionIds.filter((permissionId) => !existingPermissionIds.has(permissionId));
    const permissionIdsToRemove = existingRolePermissions
      .map((item) => item.permissionId)
      .filter((permissionId) => !targetPermissionIdSet.has(permissionId));

    if (permissionIdsToRemove.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: { in: permissionIdsToRemove },
        },
      });
    }

    if (permissionIdsToAdd.length > 0) {
      await prisma.$transaction(
        permissionIdsToAdd.map((permissionId) =>
          prisma.$executeRaw`
            INSERT INTO "RolePermission" ("roleId", "permissionId")
            VALUES (${roleId}, ${permissionId})
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
          `
        )
      );
    }
  }

  const adminRoleId = roleIdByKey.get("ADMIN");
  const userRoleId = roleIdByKey.get("USER");

  if (adminRoleId) {
    await prisma.user.updateMany({
      where: { role: "PLATFORM_ADMIN" },
      data: { roleId: adminRoleId },
    });
  }

  if (userRoleId) {
    await prisma.user.updateMany({
      where: { role: "USER" },
      data: { roleId: userRoleId },
    });
  }

  console.log("RBAC Role / Permission / RolePermission 시드와 기본 roleId 보정이 완료되었습니다.");
}

async function main() {
  const hashedAdmin = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const hashedTest = await bcrypt.hash(TEST_USER_PASSWORD, 12);

  const existing = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
  });

  if (existing) {
    await prisma.user.update({
      where: { username: ADMIN_USERNAME },
      data: { password: hashedAdmin, role: "PLATFORM_ADMIN" },
    });
    console.log(`관리자 계정 비밀번호가 업데이트되었습니다. (아이디: ${ADMIN_USERNAME})`);
  } else {
    await prisma.user.create({
      data: {
        name: "관리자",
        username: ADMIN_USERNAME,
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@carom.local",
        password: hashedAdmin,
        role: "PLATFORM_ADMIN",
      },
    });
    console.log(`관리자 계정이 생성되었습니다. (아이디: ${ADMIN_USERNAME}, 비밀번호: 설정한 값)`);
  }

  // 대진표 테스트용 회원 64명 (test1~test64, 참가자1~참가자64, 비밀번호 동일)
  for (let i = 1; i <= 64; i++) {
    const username = `test${i}`;
    const email = `test${i}@test.carom.local`;
    const name = `참가자${i}`;
    const existingTest = await prisma.user.findUnique({
      where: { username },
    });
    if (existingTest) {
      await prisma.user.update({
        where: { username },
        data: { name, email, password: hashedTest, role: "USER", status: "ACTIVE" },
      });
    } else {
      await prisma.user.create({
        data: {
          username,
          name,
          email,
          password: hashedTest,
          role: "USER",
          status: "ACTIVE",
        },
      });
    }
  }
  console.log("대진표 테스트용 회원 64명이 생성/업데이트되었습니다. (test1~test64, 비밀번호 동일)");

  await seedRbac();

  // 기본 당구장(업체 타입 VENUE) 1개 생성 (DB 스키마가 맞을 때만)
  try {
    const defaultVenueSlug = "default-venue";
    const existingVenue = await prisma.organization.findUnique({
      where: { slug: defaultVenueSlug },
    });
    if (!existingVenue) {
      await prisma.organization.create({
        data: {
          name: "기본 당구장",
          slug: defaultVenueSlug,
          type: "VENUE",
          description: "시드로 생성된 기본 당구장입니다. 관리자 > 당구장관리에서 수정할 수 있습니다.",
        },
      });
      console.log("기본 당구장(타입 VENUE)이 생성되었습니다.");
    }
  } catch (e) {
    console.warn("기본 당구장 생성은 건너뜁니다 (DB 스키마 불일치 시):", (e as Error).message);
  }

  // 10단계: 기본 기능·요금제·등록상품 시드
  try {
    const features = [
      { code: "TOURNAMENT_PROMO_PAGE", name: "대회 홍보 페이지", description: "대회 홍보 페이지 노출/편집" },
      { code: "PARTICIPANT_MANAGEMENT", name: "참가자 관리", description: "참가 신청·확정·출석 관리" },
      { code: "BRACKET_SYSTEM", name: "대진표 시스템", description: "대진표 생성·관리" },
      { code: "SETTLEMENT_SYSTEM", name: "정산 시스템", description: "경기 결과·정산" },
      { code: "MULTI_ZONE_OPERATION", name: "다권역 운영", description: "부/권역 설정·공동관리자 배정" },
    ];
    for (const f of features) {
      await prisma.feature.upsert({
        where: { code: f.code },
        create: { ...f, isActive: true },
        update: { name: f.name, description: f.description ?? null },
      });
    }
    console.log("기본 기능 5종이 생성/업데이트되었습니다.");

    const annualPlan = await prisma.pricingPlan.upsert({
      where: { code: "annual_membership" },
      create: {
        code: "annual_membership",
        name: "연회원",
        planType: "ANNUAL",
        billingType: "YEARLY",
        price: 0,
        currency: "KRW",
        isActive: true,
        validDays: 365,
      },
      update: { isActive: true },
    });
    const featureIds = await prisma.feature.findMany({ where: { code: { in: features.map((x) => x.code) } }, select: { id: true, code: true } });
    for (const feat of featureIds) {
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: annualPlan.id, featureId: feat.id } },
        create: { planId: annualPlan.id, featureId: feat.id },
        update: {},
      });
    }
    console.log("연회원 요금제 및 포함 기능이 연결되었습니다.");

    const listingProducts = [
      { code: "VENUE_PROMOTION", name: "당구장 홍보 등록", postingMonths: 1, price: 0 },
      { code: "TOURNAMENT_POSTING", name: "대회 등록", postingMonths: 1, price: 0 },
      { code: "LESSON_POSTING", name: "레슨 등록", postingMonths: 1, price: 0 },
      { code: "CLUB_POSTING", name: "동호회 등록", postingMonths: 1, price: 0 },
    ];
    for (const p of listingProducts) {
      await prisma.listingProduct.upsert({
        where: { code: p.code },
        create: { ...p, currency: "KRW", isActive: true, appliesToGeneralOnly: true },
        update: { name: p.name, postingMonths: p.postingMonths, price: p.price },
      });
    }
    console.log("등록상품 4종이 생성/업데이트되었습니다.");
  } catch (e) {
    console.warn("10단계 시드(기능/요금제/등록상품) 건너뜁니다:", (e as Error).message);
  }

  // 커뮤니티 게시판. slug는 API/라우트와 정확히 일치해야 함 (lib/community-ensure-boards.ts와 동일 목록)
  // trouble = 난구해결사 (노트에서 "난구해결로 보내기" 시 사용)
  try {
    const boards = [
      { slug: "notice", name: "공지사항", description: "관리자 공지", type: "notice", sortOrder: 0 },
      { slug: "free", name: "자유게시판", description: "일반 커뮤니티", type: "free", sortOrder: 1 },
      { slug: "qna", name: "질문/Q&A", description: "당구 기술·장비·룰 질문", type: "qna", sortOrder: 2 },
      { slug: "tips", name: "공략/팁", description: "당구 공략과 팁", type: "tips", sortOrder: 3 },
      { slug: "reviews", name: "후기", description: "장비·당구장·대회 후기", type: "reviews", sortOrder: 4 },
      { slug: "trouble", name: "난구해결사", description: "문제구 질문 및 해법 토론", type: "trouble", sortOrder: 5 },
    ];
    for (const b of boards) {
      await prisma.communityBoard.upsert({
        where: { slug: b.slug },
        create: { ...b, isActive: true },
        update: { name: b.name, description: b.description ?? null, type: b.type, sortOrder: b.sortOrder },
      });
    }
    console.log("커뮤니티 게시판이 생성/업데이트되었습니다.");
  } catch (e) {
    console.warn("커뮤니티 게시판 시드 건너뜁니다:", (e as Error).message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
