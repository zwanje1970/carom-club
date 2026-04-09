import Link from "next/link";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { OPERATIONS_QUICK_ACTION_CARD_CLASS } from "@/components/client/console/operationsQuickActionCardClass";
import { IconBug, IconMegaphone } from "@/components/client/console/quickActionIcons";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";

export const metadata = {
  title: "설정",
};

export default async function ClientSettingsPage() {
  const copy = await getAdminCopy();
  const c = copy as Record<AdminCopyKey, string>;
  const card = OPERATIONS_QUICK_ACTION_CARD_CLASS;

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="계정·앱"
        title="설정"
        description="로그인·알림·연동·권한 등 일반 설정은 준비 중입니다. 조직·사업장 프로필·연락처는 「내 정보/사업장 관리」에서 다룹니다."
      />

      <ConsoleSection title={getCopyValue(c, "client.settings.feedbackSectionTitle")} plain>
        <p className="mb-3 text-[12px] text-zinc-600 dark:text-zinc-400">
          {getCopyValue(c, "client.settings.feedbackSectionDescription")}
        </p>
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <Link href="/client/feedback/feature" className={card}>
            <IconMegaphone className="text-zinc-700 dark:text-zinc-200" />
            {getCopyValue(c, "client.operations.quick.featureFeedback")}
          </Link>
          <Link href="/client/feedback/bug" className={card}>
            <IconBug className="text-zinc-700 dark:text-zinc-200" />
            {getCopyValue(c, "client.operations.quick.bugReport")}
          </Link>
        </div>
      </ConsoleSection>

      <ConsoleSection title="운영 설정 바로가기" plain>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Link
            href="/client/setup"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            내 정보
          </Link>
          <Link
            href="/client/setup"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            당구장 정보
          </Link>
          <Link
            href="/client/promo"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            홍보 페이지 연동
          </Link>
        </div>
      </ConsoleSection>

      <ConsoleSection title="예정 항목" plain>
        <ul className="list-inside list-disc space-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
          <li>알림 수신</li>
          <li>외부 연동</li>
          <li>권한·세션</li>
        </ul>
      </ConsoleSection>
    </div>
  );
}
