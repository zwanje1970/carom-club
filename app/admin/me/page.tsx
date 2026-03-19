import { redirect } from "next/navigation";
import { mdiAccountCircle } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/format-date";
import { prisma } from "@/lib/db";
import { AdminMeForm } from "@/components/admin/AdminMeForm";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

export default async function AdminMePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let user: Awaited<ReturnType<typeof prisma.user.findUnique<{ where: { id: string } }>>> = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.id },
    });
  } catch {
    user = {
      id: session.id,
      name: session.name,
      username: session.username,
      email: "",
      phone: null,
      password: "",
      role: "PLATFORM_ADMIN",
      status: null,
      withdrawnAt: null,
      latitude: null,
      longitude: null,
      address: null,
      addressDetail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      communityScore: 0,
    };
  }
  if (!user) redirect("/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiAccountCircle} title="본인 정보" />

      <div className="space-y-6">
        <CardBox>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">기본 정보</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-gray-500 dark:text-slate-400">이름</dt>
            <dd className="text-gray-900 dark:text-slate-100">{user.name}</dd>
            <dt className="text-gray-500 dark:text-slate-400">연락처</dt>
            <dd>{user.phone ?? "-"}</dd>
            <dt className="text-gray-500 dark:text-slate-400">이메일</dt>
            <dd>{user.email}</dd>
            <dt className="text-gray-500 dark:text-slate-400">닉네임</dt>
            <dd>{user.username}</dd>
            <dt className="text-gray-500 dark:text-slate-400">권한</dt>
            <dd>{user.role === "PLATFORM_ADMIN" ? "플랫폼 관리자" : user.role === "CLIENT_ADMIN" ? "클라이언트 관리자" : user.role === "ZONE_MANAGER" ? "권역 관리자" : "일반회원"}</dd>
            <dt className="text-gray-500 dark:text-slate-400">계정 생성일</dt>
            <dd>{formatKoreanDate(user.createdAt)}</dd>
          </dl>
        </CardBox>

        <CardBox>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">비밀번호 변경</h2>
          <AdminMeForm />
        </CardBox>

        <CardBox>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">로그아웃</h2>
          <AdminLogoutButton />
        </CardBox>
      </div>
    </SectionMain>
  );
}
