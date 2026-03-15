import Link from "next/link";

const CLIENT_TYPE_LABEL: Record<string, string> = {
  GENERAL: "일반업체",
  REGISTERED: "등록업체",
};

export type FeatureGateNoticeProps = {
  /** 화면에 표시할 기능명 */
  featureName: string;
  /** 현재 업체 유형 */
  clientType: string | null;
  /** 연회원 여부 (membershipType) */
  membershipType: string | null;
  /** 연회원 유효 상태 (사용 중/만료) */
  annualActive?: boolean;
  /** 추가 안내 (선택) */
  hint?: string;
};

/**
 * 기능 접근 제한 시 공통 안내 UI.
 * "왜 이 기능을 쓸 수 없는지 / 무엇이 필요한지" 사용자에게 명확히 표시.
 */
export function FeatureGateNotice({
  featureName,
  clientType,
  membershipType,
  annualActive = false,
  hint,
}: FeatureGateNoticeProps) {
  const clientLabel = CLIENT_TYPE_LABEL[clientType ?? "GENERAL"] ?? clientType ?? "—";
  const isAnnual = membershipType === "ANNUAL";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        이 기능은 사용 권한이 필요합니다.
      </p>
      <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
        <strong>{featureName}</strong>을(를) 사용하려면 연회원 가입 또는 해당 기능 부여가 필요합니다.
      </p>
      <dl className="mt-4 grid gap-1 text-sm text-amber-800 dark:text-amber-300">
        <div className="flex gap-2">
          <dt className="text-amber-700 dark:text-amber-400">현재 업체 구분:</dt>
          <dd>{clientLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-amber-700 dark:text-amber-400">연회원 상태:</dt>
          <dd>
            {isAnnual ? (annualActive ? "사용 중" : "만료됨") : "없음"}
          </dd>
        </div>
      </dl>
      {hint && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{hint}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/client/billing"
          className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          이용 현황 보기
        </Link>
        <Link
          href="/client/billing"
          className="inline-block text-sm text-amber-800 underline hover:no-underline dark:text-amber-200"
        >
          이용 정책 확인
        </Link>
      </div>
    </div>
  );
}
