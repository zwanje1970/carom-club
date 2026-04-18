import { Suspense } from "react";
import InquiryNewClient from "./InquiryNewClient";

export default function ClientInquiryNewPage() {
  return (
    <Suspense
      fallback={
        <main className="v3-page v3-stack ui-client-dashboard">
          <p className="v3-muted">불러오는 중…</p>
        </main>
      }
    >
      <InquiryNewClient />
    </Suspense>
  );
}
