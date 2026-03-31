import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import Link from "next/link";

export const metadata = {
  title: "설정",
};

export default function ClientSettingsPage() {
  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="계정·앱"
        title="설정"
        description="로그인·알림·연동·권한 등 일반 설정은 준비 중입니다. 조직·사업장 프로필·연락처는 「내 정보/사업장 관리」에서 다룹니다."
      />
      <ConsoleSection title="예정 항목" plain>
        <ul className="list-inside list-disc space-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
          <li>알림 수신</li>
          <li>외부 연동</li>
          <li>권한·세션</li>
        </ul>
        <p className="mt-3 text-[12px] text-zinc-500">
          사업장 주소·소개·이미지 등은{" "}
          <Link href="/client/setup" className="font-medium text-indigo-800 underline dark:text-indigo-300">
            내 정보/사업장 관리
          </Link>
          로 이동하세요.
        </p>
      </ConsoleSection>
    </div>
  );
}
