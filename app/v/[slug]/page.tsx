import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  promoPublished: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressNaverMapEnabled: boolean | null;
  region: string | null;
  type: string;
  typeSpecificJson: string | null;
};

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

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let venue: VenueRow | null = null;

  if (isDatabaseConfigured()) {
    try {
      const row = await prisma.organization.findFirst({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          description: true,
          promoPublished: true,
          logoImageUrl: true,
          coverImageUrl: true,
          phone: true,
          email: true,
          website: true,
          address: true,
          addressNaverMapEnabled: true,
          region: true,
          type: true,
          typeSpecificJson: true,
        },
      });
      venue = row as VenueRow;
      if (!venue) {
        const mock = MOCK_VENUES_LIST.find((v) => v.slug === slug);
        if (mock) {
          venue = {
            id: mock.id,
            name: mock.name,
            slug: mock.slug,
            shortDescription: null,
            description: null,
            promoPublished: null,
            logoImageUrl: null,
            coverImageUrl: null,
            phone: null,
            email: null,
            website: null,
            address: null,
            addressNaverMapEnabled: null,
            region: null,
            type: "VENUE",
            typeSpecificJson: null,
          };
        }
      }
    } catch {
      const mock = MOCK_VENUES_LIST.find((v) => v.slug === slug);
      if (mock) {
        venue = {
          id: mock.id,
          name: mock.name,
          slug: mock.slug,
          shortDescription: null,
          description: null,
          promoPublished: null,
          logoImageUrl: null,
          coverImageUrl: null,
          phone: null,
          email: null,
          website: null,
          address: null,
          addressNaverMapEnabled: null,
          region: null,
          type: "VENUE",
          typeSpecificJson: null,
        };
      }
    }
  } else {
    const mock = MOCK_VENUES_LIST.find((v) => v.slug === slug);
    if (mock) {
      venue = {
        id: mock.id,
        name: mock.name,
        slug: mock.slug,
        shortDescription: null,
        description: null,
        promoPublished: null,
        logoImageUrl: null,
        coverImageUrl: null,
        phone: null,
        email: null,
        website: null,
        address: null,
        addressNaverMapEnabled: null,
        region: null,
        type: "VENUE",
        typeSpecificJson: null,
      };
    }
  }

  if (!venue) notFound();

  const venueSpecific =
    venue.type === "VENUE" ? parseVenueSpecific(venue.typeSpecificJson) : {};
  const naverMapUrl =
    venue.address && venue.addressNaverMapEnabled
      ? `https://map.naver.com/v5/search/${encodeURIComponent(venue.address)}`
      : null;

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mt-4">
          <div className="flex flex-wrap items-start gap-4">
            {venue.logoImageUrl && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-site-border bg-site-card">
                <Image
                  src={venue.logoImageUrl}
                  alt=""
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-site-text">{venue.name}</h1>
              {venue.shortDescription && (
                <p className="mt-1 text-sm text-gray-600">{venue.shortDescription}</p>
              )}
            </div>
          </div>
        </header>

        {venue.coverImageUrl && (
          <div className="relative mt-6 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-site-border bg-site-card">
            <Image
              src={venue.coverImageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}

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
                      <a
                        href={naverMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-site-primary hover:underline"
                      >
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
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-site-primary hover:underline"
                    >
                      {venue.website}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>
        )}

        {venue.type === "VENUE" &&
          (hasVenueTableInfo(venueSpecific.daedae) ||
            hasVenueTableInfo(venueSpecific.jungdae) ||
            hasVenueTableInfo(venueSpecific.pocket) ||
            venueSpecific.daedaeFee ||
            venueSpecific.jungdaeFee ||
            venueSpecific.pocketFee ||
            venueSpecific.businessHours) && (
          <section className="mt-6 rounded-2xl border border-site-border bg-site-card p-6">
            <h2 className="text-sm font-semibold text-gray-800">당구장 정보</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-site-border">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium w-16"> </th>
                    <th className="text-left py-2 pr-6 text-gray-500 font-medium">종류</th>
                    <th className="text-left py-2 pr-6 text-gray-500 font-medium w-20">대수</th>
                    <th className="text-left py-2 text-gray-500 font-medium w-24">가격</th>
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

        {venue.description && (
          <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-6">
            <p className="whitespace-pre-line text-sm text-gray-600">
              {venue.description}
            </p>
          </div>
        )}

        {venue.promoPublished ? (
          <div
            className="prose prose-sm mt-6 max-w-none rounded-2xl border border-site-border bg-site-card p-6 shadow-sm prose-p:text-gray-600"
            dangerouslySetInnerHTML={{ __html: venue.promoPublished }}
          />
        ) : (
          !venue.description && (
            <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
              <p className="text-gray-500">홍보 내용이 준비 중입니다.</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
