"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { TroubleSolutionEditor } from "@/components/trouble/TroubleSolutionEditor";

export function TroubleSolutionNewClient({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<{
    id: string;
    title: string;
    content: string;
    layoutImageUrl: string | null;
    difficulty: string | null;
    ballPlacement?: NanguBallPlacement | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/community/trouble/${postId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("게시글을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => setPost(data))
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async (payload: { content: string; solutionData: NanguSolutionData }) => {
    const res = await fetch(`/api/community/trouble/${postId}/solutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        content: payload.content,
        solutionData: payload.solutionData,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "저장에 실패했습니다.");
    router.push(`/community/trouble/${postId}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-500 dark:text-gray-400">불러오는 중…</p>
        </div>
      </main>
    );
  }
  if (error && !post) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Link href="/community/boards/trouble" className="mt-2 inline-block text-site-primary underline">
            난구해결 목록으로
          </Link>
        </div>
      </main>
    );
  }
  if (!post) return null;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
        <TroubleSolutionEditor
          layoutImageUrl={post.layoutImageUrl ?? null}
          ballPlacement={post.ballPlacement ?? null}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
