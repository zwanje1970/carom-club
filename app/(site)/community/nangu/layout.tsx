import { getSession } from "@/lib/auth";
import { NanguTroubleLoginGate } from "@/components/community/NanguTroubleLoginGate";

export default async function CommunityNanguLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    return <NanguTroubleLoginGate />;
  }
  return <>{children}</>;
}
