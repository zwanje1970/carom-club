import type { Metadata } from "next";
import CardPublishV2FontGate from "./CardPublishV2FontGate";

export const metadata: Metadata = {
  title: "게시카드 편집기",
};

export default function CardPublishV2Layout({ children }: { children: React.ReactNode }) {
  return <CardPublishV2FontGate>{children}</CardPublishV2FontGate>;
}
