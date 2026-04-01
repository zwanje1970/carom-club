import Link from "next/link";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { mdiForum } from "@mdi/js";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";

export default async function AdminCommunityPostsPage() {
  const copy = await getAdminCopy();

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiForum} title={getCopyValue(copy, "admin.community.posts.pageTitle")} />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        {getCopyValue(copy, "admin.community.posts.pageIntro")}
      </p>
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400 mb-4">{getCopyValue(copy, "admin.community.posts.cardBody")}</p>
        <Link
          href="/community"
          className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {getCopyValue(copy, "admin.community.posts.linkCommunity")}
        </Link>
      </CardBox>
    </SectionMain>
  );
}
