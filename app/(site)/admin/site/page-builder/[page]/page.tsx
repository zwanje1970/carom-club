import { notFound } from "next/navigation";
import { PageBuilderClient } from "@/components/admin/page-builder/PageBuilderClient";
import {
  PAGE_BUILDER_KEYS,
  type PageBuilderKey,
} from "@/lib/content/page-section-page-rules";

type Props = {
  params: Promise<{ page: string }>;
};

export default async function AdminSitePageBuilderByPage({ params }: Props) {
  const { page } = await params;
  if (!PAGE_BUILDER_KEYS.includes(page as PageBuilderKey)) {
    notFound();
  }
  return <PageBuilderClient terminology="block" draftToolbar initialPage={page as PageBuilderKey} />;
}
