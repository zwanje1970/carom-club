"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function CommunityPostEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [post, setPost] = useState<{ boardSlug: string; title: string; content: string; imageUrls: string[]; isPinned: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/community/posts/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("글을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        setPost({
          boardSlug: data.boardSlug,
          title: data.title,
          content: data.content,
          imageUrls: data.imageUrls ?? [],
          isPinned: data.isPinned ?? false,
        });
        setTitle(data.title);
        setContent(data.content);
        setImageUrls(data.imageUrls ?? []);
        setIsPinned(data.isPinned ?? false);
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/community/upload-image", { method: "POST", body: formData, credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");
    setImageUrls((prev) => [...prev, data.url]);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("제목을 입력하세요."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), content: content.trim(), imageUrls, isPinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      router.push(`/community/posts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6"><p className="text-gray-500">불러오는 중…</p></div>
      </main>
    );
  }
  if (!post) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600">글을 찾을 수 없습니다.</p>
          <Link href="/community" className="mt-2 inline-block text-site-primary underline">커뮤니티로</Link>
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
          <Link href={`/community/boards/${post.boardSlug}`} className="hover:text-site-primary">{post.boardSlug}</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">수정</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">글 수정</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium mb-1">제목</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </div>
          {post.boardSlug === "notice" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
              <span className="text-sm">상단 고정</span>
            </label>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">본문</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이미지</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium">
              이미지 추가
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg" />
                  <button type="button" onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs">×</button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="py-2 px-4 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50">
              {submitting ? "저장 중…" : "저장"}
            </button>
            <Link href={`/community/posts/${id}`} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 font-medium">취소</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
