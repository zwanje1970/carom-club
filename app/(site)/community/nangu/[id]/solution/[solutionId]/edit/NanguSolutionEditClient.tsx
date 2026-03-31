"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NanguSolutionEditor } from "@/components/nangu/NanguSolutionEditor";
import type { NanguBallPlacement, NanguSolutionData } from "@/lib/nangu-types";

export function NanguSolutionEditClient({
  postId,
  solutionId,
}: {
  postId: string;
  solutionId: string;
}) {
  const router = useRouter();
  const [post, setPost] = useState<{
    ballPlacement: NanguBallPlacement;
    title: string;
    content: string;
  } | null>(null);
  const [solution, setSolution] = useState<{
    id: string;
    comment: string | null;
    data: NanguSolutionData;
    authorId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/community/nangu/${postId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("게시글을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        setPost({
          ballPlacement: data.ballPlacement,
          title: data.title ?? "",
          content: data.content ?? "",
        });
        const sol = data.solutions?.find((s: { id: string }) => s.id === solutionId);
        if (!sol) throw new Error("해법을 찾을 수 없습니다.");
        setSolution({
          id: sol.id,
          comment: sol.comment,
          data: sol.data as NanguSolutionData,
          authorId: sol.authorId,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [postId, solutionId]);

  const handleSubmit = async (payload: {
    title?: string | null;
    comment?: string | null;
    data: NanguSolutionData;
  }) => {
    const res = await fetch(`/api/community/nangu/${postId}/solutions/${solutionId}`, {
      method: "PATCH",
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
  if (error || !post || !solution) {
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

  const initialSolutionData: Partial<NanguSolutionData> = {
    ...solution.data,
    explanationText: solution.data.explanationText ?? solution.comment ?? "",
  };

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">
            커뮤니티
          </Link>
          <span aria-hidden>/</span>
          <Link href="/community/nangu" className="hover:text-site-primary">
            난구해결사
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/community/nangu/${postId}`} className="hover:text-site-primary">
            상세
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">해법 수정</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">해법 수정</h1>
        <NanguSolutionEditor
          key={solutionId}
          ballPlacement={post.ballPlacement}
          postTitle={post.title}
          postContent={post.content}
          initialSolutionData={initialSolutionData}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
