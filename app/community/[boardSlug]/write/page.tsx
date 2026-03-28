"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MobileHeader from "@/components/common/MobileHeader";

const BOARD_OPTIONS = [
  { value: "notice", label: "공지사항(관리자 전용)" },
  { value: "free", label: "자유게시판" },
  { value: "qna", label: "질문게시판" },
] as const;

function normalizeBoardSlug(raw: string): string {
  return BOARD_OPTIONS.some((o) => o.value === raw) ? raw : "";
}

export default function CommunityBoardSlugWritePage() {
  const params = useParams();
  const router = useRouter();
  const boardSlug = params.boardSlug as string;
  const [selectedBoardSlug, setSelectedBoardSlug] = useState<string>(() =>
    normalizeBoardSlug(boardSlug)
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (boardSlug === "trouble") {
      router.replace("/community/nangu/write");
    }
  }, [boardSlug, router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/community/upload-image", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setImageUrls((prev) => [...prev, data.url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoardSlug) {
      alert("카테고리를 선택하세요.");
      return;
    }
    if (!title.trim()) { setError("제목을 입력하세요."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/community/boards/${selectedBoardSlug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), content: content.trim(), imageUrls, isPinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      const detailHref = `/community/${selectedBoardSlug}/${data.id}`;
      router.push(detailHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <MobileHeader title="글쓰기" showBack showClose onClosePath="/community" confirmClose />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 pt-14 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <Link href={`/community/${boardSlug}`} className="hover:text-site-primary">{boardSlug}</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">글쓰기</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">글쓰기</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="post-category" className="block text-sm font-medium mb-1">
              카테고리
            </label>
            <select
              id="post-category"
              value={selectedBoardSlug}
              onChange={(e) => setSelectedBoardSlug(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              required
            >
              <option value="">카테고리 선택</option>
              {BOARD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="post-title" className="block text-sm font-medium mb-1">제목</label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              placeholder="제목"
            />
          </div>
          {selectedBoardSlug === "notice" && (
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
              placeholder="내용"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이미지</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium">
              이미지 추가
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !selectedBoardSlug}
              className="py-2 px-4 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
            >
              {submitting ? "등록 중…" : "등록"}
            </button>
            <Link href={`/community/${boardSlug}`} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 font-medium">
              취소
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
