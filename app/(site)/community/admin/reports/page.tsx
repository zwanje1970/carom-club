import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
import Link from "next/link";
import CommunityReportsClient from "./CommunityReportsClient";

export const dynamic = "force-dynamic";

export default async function CommunityAdminReportsPage() {
  const session = await getSession();
  if (!session || !canManageReports(session)) {
    redirect("/community");
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">신고 관리</span>
        </nav>
        <h1 className="text-xl font-bold mb-4">커뮤니티 신고 관리</h1>
        <CommunityReportsClient />
      </div>
    </main>
  );
}
