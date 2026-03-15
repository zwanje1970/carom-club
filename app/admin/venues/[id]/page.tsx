import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mdiOfficeBuilding, mdiPencil, mdiCashMultiple } from "@mdi/js";
import { prisma } from "@/lib/db";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { AdminOrganizationGrants } from "@/components/admin/AdminOrganizationGrants";
import { VenueSlugEdit } from "@/components/admin/VenueSlugEdit";

const CLIENT_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;
const TYPE_LABELS: Record<string, string> = {
  VENUE: "당구장",
  CLUB: "동호회",
  FEDERATION: "연맹",
  INSTRUCTOR: "레슨",
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "정상",
  SUSPENDED: "정지",
  EXPELLED: "제명",
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

export default async function AdminVenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let org: {
    id: string;
    name: string;
    slug: string | null;
    type: string;
    status: string;
    adminRemarks: string | null;
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
    typeSpecificJson: string | null;
  } | null = null;

  try {
    const row = await prisma.organization.findFirst({
      where: { id, type: { in: [...CLIENT_TYPES] } },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        adminRemarks: true,
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
        typeSpecificJson: true,
      },
    });
    org = row as typeof org;
  } catch {
    const mock = MOCK_VENUES_LIST.find((v) => v.id === id);
    if (mock) {
      org = {
        id: mock.id,
        name: mock.name,
        slug: mock.slug,
        type: "VENUE",
        status: "ACTIVE",
        adminRemarks: null,
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
        typeSpecificJson: null,
      };
    }
  }

  if (!org) notFound();

  const venueSpecific =
    org.type === "VENUE" ? parseVenueSpecific(org.typeSpecificJson) : {};
  const naverMapUrl =
    org.address && org.addressNaverMapEnabled
      ? `https://map.naver.com/v5/search/${encodeURIComponent(org.address)}`
      : null;

  return (
    <SectionMain>
      <SectionTitleLineWithButton
        icon={mdiOfficeBuilding}
        title={org.name}
        main
      >
        <Button href="/admin/venues" label="← 클라이언트 목록" color="contrast" small />
      </SectionTitleLineWithButton>

      <div className="mt-6 space-y-6">
        {/* 기본 정보 */}
        <CardBox>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            기본 정보
          </h2>
          <div className="flex flex-wrap items-start gap-4">
            {org.logoImageUrl && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
                <Image
                  src={org.logoImageUrl}
                  alt=""
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p><span className="text-gray-500 dark:text-slate-400">상호</span> {org.name}</p>
              <p>
                <span className="text-gray-500 dark:text-slate-400">SLUG</span>{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-slate-700">{org.slug ?? "—"}</code>
              </p>
              <VenueSlugEdit organizationId={org.id} initialSlug={org.slug} />
              {org.shortDescription && (
                <p><span className="text-gray-500 dark:text-slate-400">한줄 소개</span> {org.shortDescription}</p>
              )}
            </div>
          </div>
          {org.coverImageUrl && (
            <div className="relative mt-4 aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
              <Image
                src={org.coverImageUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          {(org.address || org.phone || org.email || org.website) && (
            <dl className="mt-4 grid gap-2 text-sm">
              {org.address && (
                <>
                  <dt className="text-gray-500 dark:text-slate-400">주소</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span>{org.address}</span>
                    {naverMapUrl && (
                      <a
                        href={naverMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        네이버 지도
                      </a>
                    )}
                  </dd>
                </>
              )}
              {org.phone && (
                <>
                  <dt className="text-gray-500 dark:text-slate-400">연락처</dt>
                  <dd>{org.phone}</dd>
                </>
              )}
              {org.email && (
                <>
                  <dt className="text-gray-500 dark:text-slate-400">이메일</dt>
                  <dd>{org.email}</dd>
                </>
              )}
              {org.website && (
                <>
                  <dt className="text-gray-500 dark:text-slate-400">웹사이트</dt>
                  <dd>
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {org.website}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          )}
          {org.description && (
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-slate-600">
              <p className="text-sm text-gray-600 dark:text-slate-400">소개</p>
              <p className="mt-1 whitespace-pre-line text-sm">{org.description}</p>
            </div>
          )}
        </CardBox>

        {/* 당구장 정보 (VENUE인 경우) */}
        {org.type === "VENUE" &&
          (hasVenueTableInfo(venueSpecific.daedae) ||
            hasVenueTableInfo(venueSpecific.jungdae) ||
            hasVenueTableInfo(venueSpecific.pocket) ||
            venueSpecific.daedaeFee ||
            venueSpecific.jungdaeFee ||
            venueSpecific.pocketFee ||
            venueSpecific.businessHours) && (
          <CardBox>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              당구장 정보
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-600">
                    <th className="w-16 py-2 pr-4 text-left font-medium text-gray-500 dark:text-slate-400"> </th>
                    <th className="py-2 pr-6 text-left font-medium text-gray-500 dark:text-slate-400">종류</th>
                    <th className="w-20 py-2 pr-6 text-left font-medium text-gray-500 dark:text-slate-400">대수</th>
                    <th className="w-24 py-2 text-left font-medium text-gray-500 dark:text-slate-400">가격</th>
                  </tr>
                </thead>
                <tbody>
                  {venueSpecific.daedae && hasVenueTableInfo(venueSpecific.daedae) && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">대대</td>
                      <td className="py-2 pr-6">{venueSpecific.daedae.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.daedae.count?.trim() ? `${venueSpecific.daedae.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.daedae.fee?.trim() ? formatFee(venueSpecific.daedae.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.daedae?.kind && !venueSpecific.daedae?.count && !venueSpecific.daedae?.fee && venueSpecific.daedaeFee && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">대대</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2">{formatFee(venueSpecific.daedaeFee)}</td>
                    </tr>
                  )}
                  {venueSpecific.jungdae && hasVenueTableInfo(venueSpecific.jungdae) && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">중대</td>
                      <td className="py-2 pr-6">{venueSpecific.jungdae.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.jungdae.count?.trim() ? `${venueSpecific.jungdae.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.jungdae.fee?.trim() ? formatFee(venueSpecific.jungdae.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.jungdae?.kind && !venueSpecific.jungdae?.count && !venueSpecific.jungdae?.fee && venueSpecific.jungdaeFee && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">중대</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2 pr-6">-</td>
                      <td className="py-2">{formatFee(venueSpecific.jungdaeFee)}</td>
                    </tr>
                  )}
                  {venueSpecific.pocket && hasVenueTableInfo(venueSpecific.pocket) && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">포켓</td>
                      <td className="py-2 pr-6">{venueSpecific.pocket.kind?.trim() ?? "-"}</td>
                      <td className="py-2 pr-6">{venueSpecific.pocket.count?.trim() ? `${venueSpecific.pocket.count.trim()}대` : "-"}</td>
                      <td className="py-2">{venueSpecific.pocket.fee?.trim() ? formatFee(venueSpecific.pocket.fee) : "-"}</td>
                    </tr>
                  )}
                  {!venueSpecific.pocket?.kind && !venueSpecific.pocket?.count && !venueSpecific.pocket?.fee && venueSpecific.pocketFee && (
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">포켓</td>
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
                <span className="text-gray-500 dark:text-slate-400">영업시간 </span>
                <span>{venueSpecific.businessHours}</span>
              </p>
            )}
          </CardBox>
        )}

        {/* 구독/기능 부여 (플랫폼 관리자) */}
        <AdminOrganizationGrants organizationId={org.id} />

        {/* 관리자 정보 */}
        <CardBox>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            관리자 정보
          </h2>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-slate-400">유형</dt>
              <dd>{TYPE_LABELS[org.type] ?? org.type}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">상태</dt>
              <dd>
                <span
                  className={
                    org.status === "EXPELLED"
                      ? "text-red-600 dark:text-red-400"
                      : org.status === "SUSPENDED"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-700 dark:text-slate-300"
                  }
                >
                  {STATUS_LABELS[org.status] ?? org.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">비고</dt>
              <dd>{org.adminRemarks || "—"}</dd>
            </div>
          </dl>
        </CardBox>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/fee-ledger">
            <Button
              icon={mdiCashMultiple}
              label="회비 장부"
              color="info"
              small
            />
          </Link>
          {org.type === "VENUE" && (
            <Link href={`/admin/venues/${org.id}/promo`}>
              <Button
                icon={mdiPencil}
                label="홍보 편집"
                color="contrast"
                small
              />
            </Link>
          )}
          {org.slug ? (
            <a
              href={`/v/${org.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              공개 페이지 보기
            </a>
          ) : (
            <span className="text-sm text-gray-500 dark:text-slate-400">slug를 설정하면 공개 페이지 링크가 활성화됩니다.</span>
          )}
        </div>
      </div>
    </SectionMain>
  );
}
