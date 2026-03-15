import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// .env 에 SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD 설정 시 사용. 없으면 아래 기본값.
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

// 대진표 테스트용 회원 64명 공통 비밀번호
const TEST_USER_PASSWORD = process.env.SEED_TEST_USER_PASSWORD ?? "test1234";

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
