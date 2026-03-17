"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { NanguSolutionForm } from "@/components/nangu/NanguSolutionForm";
import type { NanguBallPlacement } from "@/lib/nangu-types";

export default function NanguSolutionNewPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const [post, setPost] = useState<{ ballPlacement: NanguBallPlacement } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/community/nangu/${postId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("게시글을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => setPost({ ballPlacement: data.ballPlacement }))
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async (payload: {
    title?: string | null;
    comment?: string | null;
    data: {
      isBankShot: boolean;
      thicknessOffsetX?: number;
      tipX?: number;
      tipY?: number;
      paths: { points: { x: number; y: number }[] }[];
      reflectionPath?: { points: { x: number; y: number }[] };
      speed?: number;
      depth?: number;
    };
  }) => {
    const res = await fetch(`/api/community/nangu/${postId}/solutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "저장에 실패했습니다.");
    }
    router.push(`/community/nangu/${postId}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-500">불러오는 중…</p>
        </div>
      </main>
    );
  }
  if (error || !post) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600">{error}</p>
          <Link href={`/community/nangu/${postId}`} className="mt-2 inline-block text-site-primary underline">
            게시글로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <Link href="/community/nangu" className="hover:text-site-primary">난구해결사</Link>
          <span aria-hidden>/</span>
          <Link href={`/community/nangu/${postId}`} className="hover:text-site-primary">상세</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">해법 제시</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">해법 제시</h1>
        <NanguSolutionForm ballPlacement={post.ballPlacement} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
