"use client";

import { PageBuilderClient } from "@/components/admin/page-builder/PageBuilderClient";

export default function AdminPageBuilderPage() {
  return (
    <div className="w-full min-w-0">
      <PageBuilderClient terminology="block" draftToolbar />
    </div>
  );
}
