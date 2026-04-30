import PlatformPushBroadcastClient from "./PlatformPushBroadcastClient";

export default function PlatformPushPage() {
  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">전체 회원 또는 클라이언트 계정 대상 앱 푸시 (발송 연결 전)</p>
      <PlatformPushBroadcastClient />
    </main>
  );
}
