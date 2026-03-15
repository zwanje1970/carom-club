-- AlterTable: Organization.slug nullable (기존 데이터 호환, 당구장 전용 URL 준비)
ALTER TABLE "Organization" ALTER COLUMN "slug" DROP NOT NULL;
