import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { EditProfileForm } from "@/components/mypage/EditProfileForm";

export default async function MypageEditPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  type UserWithProfile = Awaited<
    ReturnType<
      typeof prisma.user.findUnique<{
        where: { id: string };
        include: { memberProfile: true };
      }>
    >
  >;
  let user: UserWithProfile = null;

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
        createdAt: new Date(),
        updatedAt: new Date(),
        memberProfile: null,
      };
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
      createdAt: new Date(),
      updatedAt: new Date(),
      memberProfile: null,
    };
  }

  if (!user) {
    redirect("/login");
  }

  const profile = user.memberProfile;
  const initial = {
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    handicap: profile?.handicap ?? "",
    avg: profile?.avg ?? "",
  };

  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">회원정보 수정</h1>
          <Link
            href="/mypage"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            마이페이지로
          </Link>
        </div>

        <div className="bg-site-card rounded-lg shadow border border-site-border p-6">
          <p className="text-sm text-gray-500 mb-4">
            로그인 닉네임: <strong>{user.username}</strong> (변경 불가)
          </p>
          <EditProfileForm initial={initial} />
        </div>
      </div>
    </main>
  );
}
