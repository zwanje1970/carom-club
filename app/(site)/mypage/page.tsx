import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { ClientApplyBottomCta } from "@/components/mypage/ClientApplyBottomCta";
import { MypageProfileCard } from "@/components/mypage/MypageProfileCard";
import { MypageActionButtons } from "@/components/mypage/MypageActionButtons";
import { MypageAccordion } from "@/components/mypage/MypageAccordion";

export default async function MypagePage() {
  console.time("mypage_total");
  console.time("mypage_session");
  const session = await getSession();
  console.timeEnd("mypage_session");
  if (!session) {
    redirect("/login");
  }

  type BasicUser = { id: string };
  let user: BasicUser | null = null;

  if (isDatabaseConfigured()) {
    try {
      console.time("mypage_main_query");
      user = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
        },
      });
      console.timeEnd("mypage_main_query");
    } catch {
      console.timeEnd("mypage_main_query");
      user = {
        id: session.id,
      };
    }
  } else {
    user = {
      id: session.id,
    };
  }
  if (!user) {
    redirect("/login");
  }
  console.timeEnd("mypage_total");

  const sessionInfo = {
    name: session.name,
    role: session.role,
    loginMode: session.loginMode,
    isClientAccount: session.isClientAccount,
  };

  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-4 text-xl font-bold md:text-2xl md:block hidden">마이페이지</h1>

        {/* 프로필 카드: 이름, 로그인 상태, 계정 유형 */}
        <div className="mb-4">
          <MypageProfileCard session={sessionInfo} />
        </div>

        {/* 로그인 전환 / 로그아웃 버튼 */}
        <div className="mb-6">
          <MypageActionButtons session={sessionInfo} />
        </div>

        {/* 아코디언 메뉴 */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">메뉴</h2>
          <MypageAccordion session={{ role: session.role, loginMode: session.loginMode }} />
        </div>

        {/* 회원탈퇴는 내 정보 수정 페이지에서 진행 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          {session.role === "USER" && (
            <Link
              href="/mypage/edit"
              prefetch={false}
              className="mt-4 inline-block text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              회원탈퇴
            </Link>
          )}
        </div>

        {session.role === "USER" && (
          <ClientApplyBottomCta />
        )}
      </div>
    </main>
  );
}