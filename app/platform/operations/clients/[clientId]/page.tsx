import { notFound } from "next/navigation";
import { getClientOrganizationByIdForPlatform } from "../../../../../lib/surface-read";
import ClientOrganizationDetailForm from "./ClientOrganizationDetailForm";

export default async function PlatformClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const org = await getClientOrganizationByIdForPlatform(clientId);
  if (!org) notFound();

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <section className="v3-box v3-stack">
        <p>조직명: {org.name}</p>
        <p>슬러그: {org.slug || "-"}</p>
        <p>연락처: {org.phone ?? "-"}</p>
        <p>이메일: {org.email ?? "-"}</p>
        <p>지역: {org.region ?? "-"}</p>
      </section>

      <ClientOrganizationDetailForm
        clientId={org.id}
        initial={{
          name: org.name,
          status: org.status,
          clientType: org.clientType,
          membershipType: org.membershipType,
          membershipExpireAt: org.membershipExpireAt,
          adminRemarks: org.adminRemarks,
        }}
      />
    </main>
  );
}
