import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientOrganizationByIdForPlatform } from "../../../../../lib/server/dev-store";
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
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">클라이언트 상세</h1>
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

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <Link className="v3-btn" href="/platform/operations/clients/list">
          클라이언트 목록
        </Link>
        <Link className="v3-btn" href="/platform/operations/clients">
          신청 관리
        </Link>
      </div>
    </main>
  );
}
