import Link from "next/link";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

type Props = {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
};

/** 플랫폼 관리자가 대회 실무 라우트에 접근했을 때 표시. 조회 전용 안내 + 대시보드/대회 현황 링크 */
export function ClientOnlyBlock({
  title = "클라이언트 관리자 전용",
  message = "이 기능은 대회를 운영하는 클라이언트 관리자 전용입니다. 플랫폼 관리자는 대회 생성·수정·참가자·대진표 관리를 할 수 없습니다.",
  backHref = "/admin",
  backLabel = "대시보드로",
}: Props) {
  return (
    <CardBox>
      <p className="font-medium text-gray-900 dark:text-slate-100">{title}</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{message}</p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Button href={backHref} label={backLabel} color="contrast" outline small />
        <Button href="/admin/tournaments" label="대회 현황" color="info" small />
      </p>
    </CardBox>
  );
}
