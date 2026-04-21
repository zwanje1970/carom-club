import Link from "next/link";
import MembershipSettingsClient from "./MembershipSettingsClient";

export default function PlatformMembershipSettingsPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">연회원 관리</h1>
      <MembershipSettingsClient />
      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <Link className="v3-btn" href="/platform/operations/clients">
          신청 관리
        </Link>
      </div>
    </main>
  );
}
