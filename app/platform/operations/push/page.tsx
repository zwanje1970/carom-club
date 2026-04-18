import Link from "next/link";
import PlatformPushBroadcastClient from "./PlatformPushBroadcastClient";

export default function PlatformPushPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">플랫폼 푸시</h1>
      <p className="v3-muted">전체 회원 또는 클라이언트 계정 대상 앱 푸시 (발송 연결 전)</p>
      <PlatformPushBroadcastClient />
      <Link className="v3-btn" href="/platform/operations" style={{ alignSelf: "flex-start" }}>
        운영 관리로
      </Link>
    </main>
  );
}
