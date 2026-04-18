import Link from "next/link";
import PlatformClientInquiriesList from "./PlatformClientInquiriesList";

export default function PlatformOperationsSupportPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">문의 관리</h1>
      <PlatformClientInquiriesList />
      <Link className="v3-btn" href="/platform/operations" style={{ marginTop: "0.75rem", alignSelf: "flex-start" }}>
        운영 관리
      </Link>
    </main>
  );
}
