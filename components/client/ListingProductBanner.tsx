import { prisma } from "@/lib/db";
import { formatPrice, formatPostingMonths } from "@/lib/feature-access";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

/** 등록상품 정책 안내 (일반업체만 적용, 등록업체는 제외). code: VENUE_PROMOTION | TOURNAMENT_POSTING | LESSON_POSTING | CLUB_POSTING */
export async function ListingProductBanner({
  listingCode,
  organizationClientType,
  organizationMembershipType,
}: {
  listingCode: string;
  organizationClientType: string | null;
  organizationMembershipType: string | null;
}) {
  const annualMembershipVisible = await isAnnualMembershipVisible();
  const isRegisteredAnnual =
    organizationClientType === "REGISTERED" && organizationMembershipType === "ANNUAL";
  if (isRegisteredAnnual) {
    return (
      <div className="rounded-lg border border-site-border bg-site-card p-4 text-sm text-gray-600">
        <p className="font-medium text-site-text">
          {annualMembershipVisible ? "등록업체(연회원)" : "등록업체"}
        </p>
        <p className="mt-1">
          {annualMembershipVisible
            ? "해당 등록상품 정책(게시기간·금액) 적용 대상이 아닙니다. 별도 혜택으로 이용 가능합니다."
            : "해당 등록상품 정책(게시기간·금액) 적용 대상이 아닙니다."}
        </p>
      </div>
    );
  }

  const product = await prisma.listingProduct.findFirst({
    where: { code: listingCode, isActive: true },
  });
  if (!product) return null;

  return (
    <div className="rounded-lg border border-site-border bg-site-card p-4 text-sm">
      <p className="font-medium text-site-text">등록 안내</p>
      <p className="mt-2 text-gray-600">
        게시기간: <strong>{formatPostingMonths(product.postingMonths)}</strong>
        {" · "}
        등록금액: <strong>{formatPrice(product.price, product.currency)}</strong>
      </p>
    </div>
  );
}
