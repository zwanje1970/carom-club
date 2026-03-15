-- 유료화 확장용 필드 선반영. 현재 무료 운영, 구조만 확보.
-- Client(Organization): membershipExpireDate
-- Tournament: isPromoted, promotionLevel, promotionEndDate
-- PaymentRecord: paymentType

ALTER TABLE "Organization" ADD COLUMN "membershipExpireDate" TIMESTAMP(3);

ALTER TABLE "Tournament" ADD COLUMN "isPromoted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "promotionLevel" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "promotionEndDate" TIMESTAMP(3);

ALTER TABLE "PaymentRecord" ADD COLUMN "paymentType" TEXT;
