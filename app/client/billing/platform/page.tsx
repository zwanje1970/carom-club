import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { getMyBillingData } from "@/lib/billing-client";
import { formatPrice, formatPostingMonths } from "@/lib/feature-access";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format-date";

export const metadata = {
  title: "플랫폼 이용",
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
  GENERAL: "일반업체",
  REGISTERED: "등록업체",
};
const MEMBERSHIP_LABEL: Record<string, string> = {
  NONE: "없음",
  ANNUAL: "연회원",
};
const APPROVAL_LABEL: Record<string, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
};
const ANNUAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "사용 중",
  NONE: "없음",
  EXPIRED: "만료됨",
};
const SOURCE_LABEL: Record<string, string> = {
  ANNUAL_PLAN: "연회원",
  PLAN: "요금제",
  MANUAL: "수동 부여",
  PURCHASE: "구매",
};

export default async function ClientBillingPlatformPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">이용 현황</h1>
        <p className="text-gray-600">소속 업체가 없습니다. 클라이언트 신청 승인 후 이용할 수 있습니다.</p>
        <Link href="/client/setup" className="inline-block rounded-lg bg-site-primary px-4 py-2 text-white hover:opacity-90">
          업체 설정
        </Link>
      </div>
    );
  }

  const data = await getMyBillingData(orgId);
  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">이용 현황</h1>
        <p className="text-gray-600">조직 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { organization, annualMembershipStatus, subscriptions, featureAccessList, listingPolicy, history } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-site-text">플랫폼 이용·구독</h1>
        <Link
          href="/client/billing"
          className="text-sm font-medium text-site-primary hover:underline"
        >
          ← 대회 정산으로
        </Link>
      </div>

      {/* 1) 현재 업체 상태 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="font-semibold text-site-text">현재 업체 상태</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <span className="text-gray-600">업체 구분:</span>{" "}
            <strong>{CLIENT_TYPE_LABEL[organization.clientType] ?? organization.clientType}</strong>
          </li>
          <li>
            <span className="text-gray-600">승인 상태:</span>{" "}
            {organization.approvalStatus ? APPROVAL_LABEL[organization.approvalStatus] ?? organization.approvalStatus : "—"}
          </li>
          <li>
            <span className="text-gray-600">연회원:</span>{" "}
            <strong>{MEMBERSHIP_LABEL[organization.membershipType] ?? organization.membershipType}</strong>
            {" · "}
            <span
              className={
                annualMembershipStatus === "ACTIVE"
                  ? "text-green-600"
                  : annualMembershipStatus === "EXPIRED"
                    ? "text-amber-600"
                    : "text-gray-500"
              }
            >
              {ANNUAL_STATUS_LABEL[annualMembershipStatus] ?? annualMembershipStatus}
            </span>
          </li>
        </ul>
        {organization.clientType === "REGISTERED" && (
          <p className="mt-3 text-xs text-gray-500">
            등록업체(연회원)는 등록상품 요금 정책이 적용되지 않으며, 연회원 플랜에 포함된 기능을 사용할 수 있습니다.
          </p>
        )}
      </section>

      {/* 2) 사용 가능한 기능 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="font-semibold text-site-text">사용 가능한 기능</h2>
        <p className="mt-1 text-xs text-gray-500">제공 출처와 상태·만료일을 확인할 수 있습니다.</p>
        {featureAccessList.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">현재 사용 가능한 기능이 없습니다. 연회원 가입 또는 기능 구매/부여 시 표시됩니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-site-border text-left">
                  <th className="pb-2 font-medium text-site-text">기능</th>
                  <th className="pb-2 font-medium text-site-text">제공 출처</th>
                  <th className="pb-2 font-medium text-site-text">상태</th>
                  <th className="pb-2 font-medium text-site-text">만료일</th>
                </tr>
              </thead>
              <tbody>
                {featureAccessList.map((f) => (
                  <tr key={f.code} className="border-b border-site-border/50">
                    <td className="py-2">{f.name}</td>
                    <td className="py-2 text-gray-600">{SOURCE_LABEL[f.source] ?? f.source}</td>
                    <td className="py-2">
                      <span className={f.status === "ACTIVE" ? "text-green-600" : "text-amber-600"}>
                        {f.status === "ACTIVE" ? "사용 중" : "만료"}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{f.expiresAt ? formatKoreanDate(f.expiresAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3) 구독/부여 상태 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="font-semibold text-site-text">구독/부여 상태</h2>
        <p className="mt-1 text-xs text-gray-500">요금제 구독 및 수동 부여 이력입니다.</p>
        {subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">구독 중인 요금제가 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-site-border text-left">
                  <th className="pb-2 font-medium text-site-text">요금제</th>
                  <th className="pb-2 font-medium text-site-text">상태</th>
                  <th className="pb-2 font-medium text-site-text">시작일</th>
                  <th className="pb-2 font-medium text-site-text">만료일</th>
                  <th className="pb-2 font-medium text-site-text">출처</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-b border-site-border/50">
                    <td className="py-2">{s.planName}</td>
                    <td className="py-2">
                      <span className={s.status === "ACTIVE" ? "text-green-600" : "text-gray-500"}>
                        {s.status === "ACTIVE" ? "활성" : s.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{formatKoreanDate(s.startedAt)}</td>
                    <td className="py-2 text-gray-600">{s.expiresAt ? formatKoreanDate(s.expiresAt) : "—"}</td>
                    <td className="py-2 text-gray-500">{s.sourceType === "MANUAL" ? "수동 부여" : s.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4) 등록상품 정책 안내 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="font-semibold text-site-text">등록상품 정책 안내</h2>
        {listingPolicy.notApplicable ? (
          <p className="mt-3 text-sm text-gray-600">등록업체는 등록상품 요금 정책이 적용되지 않습니다.</p>
        ) : listingPolicy.products.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">현재 등록상품 정책이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {listingPolicy.products.map((p) => (
              <li key={p.code} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium text-site-text">{p.name}</span>
                <span className="text-gray-600">{formatPostingMonths(p.postingMonths)}</span>
                <span className="text-gray-600">{p.price === 0 ? "무료" : formatPrice(p.price, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5) 기록/이력 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="font-semibold text-site-text">결제/부여/등록 이력</h2>
        <p className="mt-1 text-xs text-gray-500">결제, 수동 부여, 등록상품 구매 이력입니다.</p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">이력이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((h) => (
              <li
                key={`${h.type}-${h.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-site-border/50 pb-2 last:border-0"
              >
                <span className="text-gray-500">{formatKoreanDateTime(h.at)}</span>
                {h.type === "PAYMENT" && (
                  <>
                    <span className="font-medium">{h.label}</span>
                    {h.amount != null && <span>{formatPrice(h.amount, h.currency ?? "KRW")}</span>}
                    <span className="text-gray-500">{h.status}</span>
                    {h.memo && <span className="text-gray-400">({h.memo})</span>}
                  </>
                )}
                {h.type === "SUBSCRIPTION_GRANT" && (
                  <>
                    <span className="font-medium">구독 부여: {h.planName}</span>
                    {h.notes && <span className="text-gray-400">({h.notes})</span>}
                  </>
                )}
                {h.type === "LISTING_PURCHASE" && (
                  <>
                    <span className="font-medium">등록: {h.productName}</span>
                    <span className="text-gray-500">{h.targetType}</span>
                    <span className={h.status === "ACTIVE" ? "text-green-600" : "text-gray-500"}>{h.status}</span>
                    {h.expiresAt && <span className="text-gray-500">~{formatKoreanDate(h.expiresAt)}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
