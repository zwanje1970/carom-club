/**
 * 11단계: 등록상품 실제 등록 시 ListingPurchaseRecord 생성.
 * - 일반업체: 정책(ListingProduct) 기준 게시기간·금액 적용
 * - 등록업체: 0원 처리 (기록은 남김)
 */
import { prisma } from "@/lib/db";

const LISTING_CODE_TO_TARGET: Record<string, string> = {
  VENUE_PROMOTION: "VENUE_PROMO",
  TOURNAMENT_POSTING: "TOURNAMENT",
  LESSON_POSTING: "LESSON",
  CLUB_POSTING: "CLUB",
};

export type CreateListingPurchaseOptions = {
  organizationId: string;
  listingCode: string;
  targetType: string;
  targetId?: string | null;
};

/**
 * 등록 확정 시 호출. 일반업체는 정책 금액/기간 적용, 등록업체는 0원.
 * 실제 PG 결제는 이번 단계에서 하지 않음.
 */
export async function createListingPurchaseRecord(
  options: CreateListingPurchaseOptions
): Promise<{ id: string } | null> {
  const { organizationId, listingCode, targetType, targetId } = options;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, clientType: true },
  });
  if (!org) return null;

  const product = await prisma.listingProduct.findFirst({
    where: { code: listingCode, isActive: true },
  });
  if (!product) return null;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + product.postingMonths);

  const isRegistered = org.clientType === "REGISTERED";
  const amount = isRegistered ? 0 : product.price;

  const record = await prisma.listingPurchaseRecord.create({
    data: {
      organizationId,
      listingProductId: product.id,
      targetType,
      targetId: targetId ?? null,
      postingMonths: product.postingMonths,
      amount,
      status: "ACTIVE",
      startedAt,
      expiresAt,
    },
  });
  return { id: record.id };
}

/** listingCode → targetType (스키마 값) */
export function getTargetTypeForListingCode(listingCode: string): string {
  return LISTING_CODE_TO_TARGET[listingCode] ?? listingCode;
}
