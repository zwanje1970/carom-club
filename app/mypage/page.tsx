import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getAvgProofStatus } from "@/lib/avg-proof";
import { AvgProofStatusBadge } from "@/components/AvgProofStatus";
import { AvgProofUpload } from "@/components/AvgProofUpload";
import { ClientApplyBottomCta } from "@/components/mypage/ClientApplyBottomCta";
import { WithdrawAccountButton } from "@/components/mypage/WithdrawAccountButton";

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

  const profile = user.memberProfile;
  const proofStatus = getAvgProofStatus(
    profile?.avgProofUrl,
    profile?.avgProofExpiresAt
  );

  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        {useMock && (
          <p className="mb-4 text-center text-sm text-site-primary">DB 없이 세션 정보만 표시 중입니다.</p>
        )}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-2xl font-bold">마이페이지</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/mypage/edit"
              className="text-sm text-site-primary hover:underline font-medium"
            >
              회원정보 수정
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              홈
            </Link>
          </div>
        </div>

        <div className="bg-site-card rounded-lg shadow border border-site-border p-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              기본 정보
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[120px_1fr]">
              <dt className="text-gray-500">회원 구분</dt>
              <dd>
                {session.role === "CLIENT_ADMIN"
                  ? "클라이언트 회원"
                  : session.role === "PLATFORM_ADMIN"
                    ? "플랫폼 관리자"
                    : "일반 회원"}
              </dd>
              <dt className="text-gray-500">이름</dt>
              <dd>{user.name}</dd>
              <dt className="text-gray-500">연락처</dt>
              <dd>{user.phone ?? "-"}</dd>
              <dt className="text-gray-500">닉네임</dt>
              <dd>{user.username}</dd>
              <dt className="text-gray-500">주소</dt>
              <dd>
                {((): string => {
                  const u = user as { address?: string | null; addressDetail?: string | null };
                  if (!u?.address?.trim()) return "-";
                  return [u.address.trim(), u.addressDetail?.trim()].filter(Boolean).join(" ");
                })()}
              </dd>
              <dt className="text-gray-500">핸디</dt>
              <dd>{profile?.handicap ?? "-"}</dd>
              <dt className="text-gray-500">AVG</dt>
              <dd>{profile?.avg ?? "-"}</dd>
              <dt className="text-gray-500">AVG 증빙 상태</dt>
              <dd>
                <AvgProofStatusBadge status={proofStatus} />
                {profile?.avgProofExpiresAt && (
                  <span className="ml-2 text-gray-500">
                    (만료일:{" "}
                    {new Date(profile.avgProofExpiresAt).toLocaleDateString(
                      "ko-KR"
                    )}
                    )
                  </span>
                )}
              </dd>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              AVG 증빙 이미지
            </h2>
            {profile?.avgProofUrl && (
              <div className="mb-3 relative w-full max-w-xs aspect-[4/3] border rounded overflow-hidden bg-gray-100">
                <Image
                  src={profile.avgProofUrl}
                  alt="AVG 증빙"
                  fill
                  className="object-contain"
                  sizes="(max-width: 384px) 100vw, 384px"
                />
              </div>
            )}
            <AvgProofUpload />
          </section>

          {session.role === "USER" && (
            <section>
              <WithdrawAccountButton />
            </section>
          )}
        </div>

        {session.role === "USER" && (
          <ClientApplyBottomCta />
        )}
      </div>
    </main>
  );
}
