-- 구조 슬롯용 필드 (기존 PageSection 확장, 신규 테이블 없음)
ALTER TABLE "PageSection" ADD COLUMN "slotType" TEXT;
ALTER TABLE "PageSection" ADD COLUMN "slotConfigJson" TEXT;

CREATE INDEX "PageSection_page_slotType_sortOrder_idx" ON "PageSection"("page", "slotType", "sortOrder");
