import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { ClientApplyBottomCta } from "@/components/mypage/ClientApplyBottomCta";
import { MypageProfileCard } from "@/components/mypage/MypageProfileCard";
import { MypageActionButtons } from "@/components/mypage/MypageActionButtons";
import { MypageQuickMenu } from "@/components/mypage/MypageQuickMenu";
import { MypageAccordion } from "@/components/mypage/MypageAccordion";

export default async function MypagePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  type UserWithProfile = Awaited<ReturnType<typeof prisma.user.findUnique<{ where: { id: string }; include: { memberProfile: true } }>>>;
  let user: UserWithProfile = null;
  let useMock = false;

  if (isDatabaseConfigured()) {
    try {
      user = await prisma.user.findUnique({
        where: { id: session.id },
        include: { memberProfile: true },
      });
    } catch {
      user = {
        id: session.id,
        name: session.name,
        username: session.username,
        email: "",
        phone: null,
        password: "",
        role: "USER",
        status: null,
        withdrawnAt: null,
        latitude: null,
        longitude: null,
        address: null,
        addressDetail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberProfile: null,
      };
      useMock = true;
    }
  } else {
    user = {
      id: session.id,
      name: session.name,
      username: session.username,
      email: "",
      phone: null,
      password: "",
      role: "USER",
      status: null,
      withdrawnAt: null,
      latitude: null,
      longitude: null,
      address: null,
      addressDetail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      memberProfile: null,
    };
    useMock = true;
  }
  if (!user) {
    redirect("/login");
  }

  const sessionInfo = {
    name: session.name,
    role: session.role,
    loginMode: session.loginMode,
    isClientAccount: session.isClientAccount,
  };

  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        {useMock && (
          <p className="mb-4 text-center text-sm text-site-primary">DB 없이 세션 정보만 표시 중입니다.</p>
        )}

        <h1 className="mb-4 text-xl font-bold md:text-2xl">마이페이지</h1>

        {/* 프로필 카드: 이름, 로그인 상태, 계정 유형 */}
        <div className="mb-4">
          <MypageProfileCard session={sessionInfo} />
        </div>

        {/* 로그인 전환 / 로그아웃 버튼 */}
        <div className="mb-6">
          <MypageActionButtons session={sessionInfo} />
        </div>

        {/* 퀵메뉴 2x2: 당구노트, 내 정보 수정 포함. 클라이언트는 클라이언트 회원이 일반회원으로 로그인했을 때만 표시 */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">퀵메뉴</h2>
          <MypageQuickMenu
            showClient={session.role === "CLIENT_ADMIN" && session.loginMode === "user"}
          />
        </div>

        {/* 아코디언 메뉴 */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">메뉴</h2>
          <MypageAccordion />
        </div>

        {/* 회원탈퇴는 내 정보 수정 페이지에서 진행 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          {session.role === "USER" && (
            <Link
              href="/mypage/edit"
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
