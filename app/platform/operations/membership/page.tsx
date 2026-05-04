import Link from "next/link";
import MembershipSettingsClient from "./MembershipSettingsClient";

export default function PlatformMembershipSettingsPage() {
  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <MembershipSettingsClient />
      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <Link className="v3-btn" href="/platform/operations/clients" prefetch={false}>
          신청 관리
        </Link>
      </div>
    </main>
  );
}
