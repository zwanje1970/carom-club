import Link from "next/link";
import PlatformUsersClient from "./PlatformUsersClient";

export default function PlatformOperationsUsersPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">회원목록</h1>
      <PlatformUsersClient />
      <Link className="v3-btn" href="/platform/operations">
        운영 관리
      </Link>
    </main>
  );
}
