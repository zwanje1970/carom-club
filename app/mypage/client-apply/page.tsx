import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { ClientApplyForm } from "@/components/mypage/ClientApplyForm";

export default async function MypageClientApplyPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "USER") {
    redirect("/mypage");
  }

  let initialData: { applicantName: string; email: string; phone: string } | null = {
    applicantName: session.name ?? "",
    email: session.email ?? "",
    phone: "",
  };
  let existingApplication: {
    id: string;
    type: string;
    status: string;
    organizationName: string;
    applicantName: string;
    phone: string;
    email: string;
    region: string | null;
    shortDescription: string | null;
    referenceLink: string | null;
  } | null = null;

  if (isDatabaseConfigured()) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, email: true, phone: true },
      });
      if (user) {
        initialData = {
          applicantName: user.name ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
        };
      }
      const app = await prisma.clientApplication.findFirst({
        where: {
          OR: [{ applicantUserId: session.id }, { email: session.email ?? "" }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          organizationName: true,
          applicantName: true,
          phone: true,
          email: true,
          region: true,
          shortDescription: true,
          referenceLink: true,
        },
      });
      if (app) {
        existingApplication = {
          id: app.id,
          type: app.type,
          status: app.status,
          organizationName: app.organizationName,
          applicantName: app.applicantName,
          phone: app.phone,
          email: app.email,
          region: app.region,
          shortDescription: app.shortDescription,
          referenceLink: app.referenceLink,
        };
      }
    } catch {
      // keep session-based initialData
    }
  }

  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">클라이언트 등록 신청</h1>
          <Link
            href="/mypage"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            마이페이지로
          </Link>
        </div>
        <p className="text-gray-600 text-sm mb-6">
          당구장·동호회·연맹·주최자·강사로 활동하시려면 신청해 주세요. 승인 후 업체를 등록하고 대회·레슨을 운영할 수 있습니다.
        </p>
        <ClientApplyForm
          successRedirect="/mypage"
          successLinkLabel="마이페이지로"
          initialData={initialData}
          existingApplication={existingApplication}
        />
      </div>
    </main>
  );
}
