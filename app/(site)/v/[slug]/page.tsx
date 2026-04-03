import { Suspense } from "react";
import { notFound } from "next/navigation";
import { sanitizeImageSrc } from "@/lib/image-src";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

type VenueSummary = {
  id: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressNaverMapEnabled: boolean | null;
  type: string;
};

type VenueDetail = {
  description: string | null;
  promoPublished: string | null;
  promoPdfUrl: string | null;
  promoImageUrl: string | null;
  typeSpecificJson: string | null;
};

type VenuePageData = VenueSummary & VenueDetail;

type VenueTableInfo = { kind?: string; count?: string; fee?: string };

function parseVenueSpecific(json: string | null): {
  daedae?: VenueTableInfo;
  jungdae?: VenueTableInfo;
  pocket?: VenueTableInfo;
  daedaeFee?: string;
  jungdaeFee?: string;
  pocketFee?: string;
  businessHours?: string;
} {
  if (!json?.trim()) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function hasVenueTableInfo(t?: VenueTableInfo): boolean {
  return !!(t?.kind?.trim() || t?.count?.trim() || t?.fee?.trim());
}

function formatFee(fee: string | undefined): string {
  if (!fee?.trim()) return "";
  const s = fee.trim();
  return s.endsWith("원") ? s : `${s}원`;
}

function getMockVenue(slug: string): VenuePageData | null {
  const mock = MOCK_VENUES_LIST.find((v) => v.slug === slug);
  if (!mock) return null;
  return {
    id: mock.id,
    name: mock.name,
    slug: mock.slug,
    shortDescription: null,
    logoImageUrl: null,
    coverImageUrl: null,
    phone: null,
    email: null,
    website: null,
    address: null,
    addressNaverMapEnabled: null,
    type: "VENUE",
    description: null,
    promoPublished: null,
    promoPdfUrl: null,
    promoImageUrl: null,
    typeSpecificJson: null,
  };
}

async function getVenueSummary(slug: string): Promise<VenueSummary | null> {
  try {
    return await prisma.organization.findFirst({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        logoImageUrl: true,
        coverImageUrl: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        addressNaverMapEnabled: true,
        type: true,
      },
    });
  } catch {
    return null;
  }
}

async function getVenueDetailContent(slug: string): Promise<VenueDetail | null> {
  try {
    return await prisma.organization.findFirst({
      where: { slug },
      select: {
        description: true,
        promoPublished: true,
        promoPdfUrl: true,
        promoImageUrl: true,
        typeSpecificJson: true,
      },
    });
  } catch {
    return null;
  }
}

function VenueHeader({ venue }: { venue: VenueSummary }) {
  const naverMapUrl =
    venue.address && venue.addressNaverMapEnabled
      ? `https://map.naver.com/v5/search/${encodeURIComponent(venue.address)}`
      : null;

  return (
    <>
      <header className="mt-4">
        <div className="flex flex-wrap items-start gap-4">
          {(() => {
            const safeLogo = sanitizeImageSrc(venue.logoImageUrl);
            if (!safeLogo) return null;
            return (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-site-border bg-site-card">
                <img
                  src={safeLogo}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  data-debug-src={safeLogo}
                />
              </div>
            );
          })()}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-site-text">{venue.name}</h1>
            {venue.shortDescription && <p className="mt-1 text-sm text-gray-600">{venue.shortDescription}</p>}
          </div>
        </div>
      </header>

      {(() => {
        const safeCover = sanitizeImageSrc(venue.coverImageUrl);
        if (!safeCover) return null;
        return (
          <div className="relative mt-6 aspect-[21/9] min-h-[120px] w-full overflow-hidden rounded-2xl border border-site-border bg-site-card">
            <img
              src={safeCover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              data-debug-src={safeCover}
            />
          </div>
        );
      })()}

      {(venue.address || venue.phone || venue.email || venue.website) && (
        <section className="mt-6 rounded-2xl border border-site-border bg-site-card p-6">
          <h2 className="text-sm font-semibold text-gray-800">연락처·위치</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            {venue.address && (
              <>
                <dt className="text-gray-500">주소</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <span>{venue.address}</span>
                  {naverMapUrl && (
                    <a href={naverMapUrl} target="_blank" rel="noopener noreferrer" className="text-site-primary hover:underline">
                      네이버 지도
                    </a>
                  )}
                </dd>
              </>
            )}
            {venue.phone && (
              <>
                <dt className="text-gray-500">연락처</dt>
                <dd>{venue.phone}</dd>
              </>
            )}
            {venue.email && (
              <>
                <dt className="text-gray-500">이메일</dt>
                <dd>{venue.email}</dd>
              </>
            )}
            {venue.website && (
              <>
                <dt className="text-gray-500">웹사이트</dt>
                <dd>
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-site-primary hover:underline">
                    {venue.website}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>
      )}
    </>
  );
}

function VenueDetailSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <section className="animate-pulse rounded-2xl border border-site-border bg-site-card p-6">
        <div className="h-5 w-32 rounded bg-site-border" />
        <div className="mt-3 space-y-2">
          <div className="h-4 w-full rounded bg-site-border" />
          <div className="h-4 w-4/5 rounded bg-site-border" />
          <div className="h-4 w-3/5 rounded bg-site-border" />
        </div>
      </section>
      <section className="animate-pulse rounded-2xl border border-site-border bg-site-card p-6">
        <div className="h-5 w-28 rounded bg-site-border" />
        <div className="mt-3 h-40 rounded bg-site-border" />
      </section>
    </div>
  );
}

async function VenueDetailSection({
  slug,
  type,
  loadDetail,
}: {
  slug: string;
  type: string;
  loadDetail: boolean;
}) {
  if (!loadDetail) {
    return (
      <section className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
        <p className="text-gray-500">홍보 내용이 준비 중입니다.</p>
      </section>
    );
  }

  const detail = await getVenueDetailContent(slug);
  const venueSpecific = type === "VENUE" ? parseVenueSpecific(detail?.typeSpecificJson ?? null) : {};
  const hasPromo = !!(detail?.promoImageUrl?.trim() || detail?.promoPublished?.trim() || detail?.promoPdfUrl?.trim());

  return (
    <div className="mt-6 space-y-6">
      {type === "VENUE" &&
        (hasVenueTableInfo(venueSpecific.daedae) ||
          hasVenueTableInfo(venueSpecific.jungdae) ||
          hasVenueTableInfo(venueSpecific.pocket) ||
          venueSpecific.daedaeFee ||
          venueSpecific.jungdaeFee ||
          venueSpecific.pocketFee ||
          venueSpecific.businessHours) && (
          <section className="rounded-2xl border border-site-border bg-site-card p-6">
            <h2 className="text-sm font-semibold text-gray-800">당구장 정보</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-site-border">
                    <th className="w-16 py-2 pr-4 text-left font-medium text-gray-500"> </th>
                    <th className="py-2 pr-6 text-left font-medium text-gray-500">종류</th>
                    <th className="w-20 py-2 pr-6 text-left font-medium text-gray-500">대수</th>
                    <th className="w-24 py-2 text-left font-medium text-gray-500">가격</th>
                  </tr>
                </thead>
                <tbody>
                  {venueSpecific.daedae && hasVenueTableInfo(venueSpecific.daedae) && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">대대</td>
                      <td className="py-2 pr-6">{venueSpecific.daedae.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.daedae.count?.trim() ? `${venueSpecific.daedae.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.daedae.fee?.trim() ? formatFee(venueSpecific.daedae.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.daedae?.kind && !venueSpecific.daedae?.count && !venueSpecific.daedae?.fee && venueSpecific.daedaeFee && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">대대</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2">{formatFee(venueSpecific.daedaeFee)}</td>
                    </tr>
                  )}
                  {venueSpecific.jungdae && hasVenueTableInfo(venueSpecific.jungdae) && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">중대</td>
                      <td className="py-2 pr-6">{venueSpecific.jungdae.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.jungdae.count?.trim() ? `${venueSpecific.jungdae.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.jungdae.fee?.trim() ? formatFee(venueSpecific.jungdae.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.jungdae?.kind && !venueSpecific.jungdae?.count && !venueSpecific.jungdae?.fee && venueSpecific.jungdaeFee && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">중대</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2">{formatFee(venueSpecific.jungdaeFee)}</td>
                    </tr>
                  )}
                  {venueSpecific.pocket && hasVenueTableInfo(venueSpecific.pocket) && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">포켓</td>
                      <td className="py-2 pr-6">{venueSpecific.pocket.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.pocket.count?.trim() ? `${venueSpecific.pocket.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.pocket.fee?.trim() ? formatFee(venueSpecific.pocket.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.pocket?.kind && !venueSpecific.pocket?.count && !venueSpecific.pocket?.fee && venueSpecific.pocketFee && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-600">포켓</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2">{formatFee(venueSpecific.pocketFee)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {venueSpecific.businessHours && (
              <p className="mt-3 text-sm">
                <span className="text-gray-500">영업시간 </span>
                <span>{venueSpecific.businessHours}</span>
              </p>
            )}
          </section>
        )}

      {detail?.description && (
        <div className="rounded-2xl border border-site-border bg-site-card p-6">
          <p className="whitespace-pre-line text-sm text-gray-600">{detail.description}</p>
        </div>
      )}

      {hasPromo ? (
        <div className="space-y-6">
          {(() => {
            const safePromo = sanitizeImageSrc(detail?.promoImageUrl);
            if (!safePromo) return null;
            return (
              <div className="relative min-h-[120px] w-full aspect-[2/1] max-h-80 overflow-hidden rounded-2xl border border-site-border bg-site-card">
                <img
                  src={safePromo}
                  alt="대표 이미지"
                  className="absolute inset-0 h-full w-full object-contain"
                  data-debug-src={safePromo}
                />
              </div>
            );
          })()}
          {detail?.promoPublished?.trim() && (
            <div
              className="prose prose-sm max-w-none rounded-2xl border border-site-border bg-site-card p-6 shadow-sm prose-p:text-gray-600"
              dangerouslySetInnerHTML={{ __html: detail.promoPublished }}
            />
          )}
          {detail?.promoPdfUrl?.trim() && (
            <a
              href={detail.promoPdfUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-site-primary/10 px-4 py-2 text-sm font-medium text-site-primary hover:bg-site-primary/20"
            >
              PDF 다운로드 / 미리보기
            </a>
          )}
        </div>
      ) : (
        !detail?.description && (
          <section className="rounded-2xl border border-site-border bg-site-card p-8 text-center">
            <p className="text-gray-500">홍보 내용이 준비 중입니다.</p>
          </section>
        )
      )}
    </div>
  );
}

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const venueFromDb = isDatabaseConfigured() ? await getVenueSummary(slug) : null;
  let venue = venueFromDb;
  let useMock = false;

  if (!venue) {
    const mock = getMockVenue(slug);
    if (mock) {
      venue = mock;
      useMock = true;
    }
  }

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <VenueHeader venue={venue} />

        <Suspense fallback={<VenueDetailSkeleton />}>
          <VenueDetailSection slug={slug} type={venue.type} loadDetail={!useMock && isDatabaseConfigured()} />
        </Suspense>
      </div>
    </main>
  );
}