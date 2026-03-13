import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// .env 에 SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD 설정 시 사용. 없으면 아래 기본값.
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

async function main() {
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
  });

  if (existing) {
    await prisma.user.update({
      where: { username: ADMIN_USERNAME },
      data: { password: hashed, role: "PLATFORM_ADMIN" },
    });
    console.log(`관리자 계정 비밀번호가 업데이트되었습니다. (아이디: ${ADMIN_USERNAME})`);
  } else {
    await prisma.user.create({
      data: {
        name: "관리자",
        username: ADMIN_USERNAME,
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@carom.local",
        password: hashed,
        role: "PLATFORM_ADMIN",
      },
    });
    console.log(`관리자 계정이 생성되었습니다. (아이디: ${ADMIN_USERNAME}, 비밀번호: 설정한 값)`);
  }

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
