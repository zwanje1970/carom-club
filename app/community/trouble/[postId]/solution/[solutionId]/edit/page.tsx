"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { TroubleSolutionEditor } from "@/components/trouble/TroubleSolutionEditor";

type SessionUser = { id: string };

export default function TroubleSolutionEditPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;
  const solutionId = params.solutionId as string;
  const [post, setPost] = useState<{
    ballPlacement: NanguBallPlacement | null;
    layoutImageUrl: string | null;
    title: string;
    content: string;
  } | null>(null);
  const [solution, setSolution] = useState<{
    id: string;
    content: string;
    solutionData: Partial<NanguSolutionData> | null;
    authorId: string;
  } | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSessionUser(d.user?.id ? { id: d.user.id } : null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/community/trouble/${postId}`, { credentials: "include" }).then((res) => {
        if (!res.ok) throw new Error("게시글을 불러올 수 없습니다.");
        return res.json();
      }),
      fetch(`/api/community/trouble/${postId}/solutions`, { credentials: "include" }).then((res) => {
        if (!res.ok) throw new Error("해법 목록을 불러올 수 없습니다.");
        return res.json();
      }),
    ])
      .then(([postData, solutions]) => {
        if (cancelled) return;
        const sol = solutions.find((s: { id: string }) => s.id === solutionId);
        if (!sol) throw new Error("해법을 찾을 수 없습니다.");
        setPost({
          ballPlacement: postData.ballPlacement ?? null,
          layoutImageUrl: postData.layoutImageUrl ?? null,
          title: postData.title ?? "",
          content: postData.content ?? "",
        });
        setSolution({
          id: sol.id,
          content: sol.content ?? "",
          solutionData: (sol.solutionData as Partial<NanguSolutionData> | null) ?? null,
          authorId: sol.authorId,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, solutionId]);

  const handleSubmit = async (payload: { content: string; solutionData: NanguSolutionData }) => {
    const res = await fetch(`/api/community/trouble/${postId}/solutions/${solutionId}`, {
      method: "PATCH",
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

  if (loading || sessionUser === undefined) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-500 dark:text-gray-400">불러오는 중…</p>
        </div>
      </main>
    );
  }
  if (error || !post || !solution) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Link href={`/community/trouble/${postId}`} className="mt-2 inline-block text-site-primary underline">
            글로
          </Link>
        </div>
      </main>
    );
  }

  if (!sessionUser) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-600 dark:text-slate-400">로그인이 필요합니다.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/community/trouble/${postId}/solution/${solutionId}/edit`)}`}
            className="mt-2 inline-block text-site-primary underline"
          >
            로그인
          </Link>
        </div>
      </main>
    );
  }

  if (solution.authorId !== sessionUser.id) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">본인 해법만 수정할 수 있습니다.</p>
          <Link href={`/community/trouble/${postId}`} className="mt-2 inline-block text-site-primary underline">
            글로
          </Link>
        </div>
      </main>
    );
  }

  const initialSolutionData: Partial<NanguSolutionData> | null = solution.solutionData;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link href="/community/boards/trouble" className="hover:text-site-primary">
            난구해결
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/community/trouble/${postId}`} className="hover:text-site-primary">
            글
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">해법 수정</span>
        </nav>
        <h1 className="text-xl font-bold mb-4 text-site-text">해법 수정</h1>
        <TroubleSolutionEditor
          key={solutionId}
          layoutImageUrl={post.layoutImageUrl}
          ballPlacement={post.ballPlacement}
          initialSolutionData={initialSolutionData}
          initialContent={solution.content}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
