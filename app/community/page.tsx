import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";

export default async function CommunityPage() {
  const common = await getCommonPageData("community");
  const c = common.copy as Record<AdminCopyKey, string>;
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-site-text">{getCopyValue(c, "site.community.title")}</h1>
        <p className="mt-4 text-gray-600">{getCopyValue(c, "site.community.subtitle")}</p>
      </div>
    </main>
  );
}
