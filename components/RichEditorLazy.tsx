"use client";

import dynamic from "next/dynamic";
import type { RichEditorProps } from "@/components/RichEditor";

const RichEditor = dynamic(
  () => import("@/components/RichEditor").then((m) => ({ default: m.RichEditor })),
  { ssr: false, loading: () => <div className="min-h-[120px] rounded border border-site-border bg-site-card/50 animate-pulse" /> }
);

export function RichEditorLazy(props: RichEditorProps) {
  return <RichEditor {...props} />;
}
