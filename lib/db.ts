// Prisma는 DATABASE_URL 환경변수 사용 (schema.prisma 참고).
// 로컬 개발 시 DATABASE_URL 없으면 로컬 PostgreSQL 기본값 사용(모든 기능 DB 활성화).
// 나중에 Neon 연결 시 .env 에 DATABASE_URL 만 Neon URL 로 바꾸면 됨.
import { ensureDatabaseUrlForDevelopment } from "@/lib/db-mode";
import { PrismaClient } from "prisma-generated";

ensureDatabaseUrlForDevelopment();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn"]
        : ["error"],
  });

/** 서버리스/프로덕션에서도 동일 프로세스 내 단일 인스턴스 재사용(커넥션 폭증 방지) */
globalForPrisma.prisma = prisma;
