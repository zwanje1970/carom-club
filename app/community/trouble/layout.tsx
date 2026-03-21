import { getSession } from "@/lib/auth";
import { NanguTroubleLoginGate } from "@/components/community/NanguTroubleLoginGate";

/** /community/trouble/[postId]/solution/new 등 정적 trouble 하위 경로 */
export default async function CommunityTroubleNestedLayout({
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
