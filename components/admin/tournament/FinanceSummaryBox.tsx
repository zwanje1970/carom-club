"use client";

export type FinanceSummary = {
  totalEntryFee: number;
  totalPrize: number;
  operatingFee: number;
  confirmedCount: number;
};

export function FinanceSummaryBox({ data }: { data: FinanceSummary }) {
  const { totalEntryFee, totalPrize, operatingFee, confirmedCount } = data;
  const venueProfit = totalEntryFee - totalPrize - operatingFee;
  const isDeficit = venueProfit < 0;

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
        대회 재정 계산
      </h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">참가 확정 인원</dt>
          <dd>{confirmedCount}명</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">총 참가비</dt>
          <dd>{totalEntryFee.toLocaleString()}원</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">총 상금</dt>
          <dd>{totalPrize.toLocaleString()}원</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">운영비</dt>
          <dd>{operatingFee.toLocaleString()}원</dd>
        </div>
        <div className="flex justify-between pt-2 border-t font-medium">
          <dt className={isDeficit ? "text-red-600" : "text-gray-800"}>
            당구장 수익
          </dt>
          <dd className={isDeficit ? "text-red-600" : "text-gray-900"}>
            {venueProfit.toLocaleString()}원
            {isDeficit && " (적자)"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
