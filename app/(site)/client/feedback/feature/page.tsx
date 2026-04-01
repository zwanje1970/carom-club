import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessClientDashboard } from "@/types/auth";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ClientFeedbackForm } from "@/components/client/console/ClientFeedbackForm";

export const metadata = {
  title: "기능 제안",
};

export default async function ClientFeatureFeedbackPage() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");
  const copy = await getAdminCopy();

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow={getCopyValue(copy, "client.operations.eyebrow")}
        title={getCopyValue(copy, "client.feedback.feature.title")}
      />
      <ClientFeedbackForm copy={copy} feedbackType="FEATURE" />
    </div>
  );
}
