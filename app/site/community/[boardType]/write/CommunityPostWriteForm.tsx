"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityPostBodyEditor, {
  type CommunityPostBodyEditorHandle,
} from "../../CommunityPostBodyEditor";
import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../../../../../lib/community-post-images";

type Props = {
  boardType: string;
};

export default function CommunityPostWriteForm({ boardType }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState({ content: "", imageUrls: [] as string[], imageSizeLevels: [] as number[] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const bodyEditorRef = useRef<CommunityPostBodyEditorHandle>(null);
  const [attachUi, setAttachUi] = useState({
    uploading: false,
    remaining: MAX_COMMUNITY_POST_IMAGE_COUNT,
  });
  const onAttachUiChange = useCallback((s: { uploading: boolean; remaining: number }) => {
    setAttachUi(s);
  }, []);

  const onBodyChange = useCallback(
    (payload: { content: string; imageUrls: string[]; imageSizeLevels: number[] }) => {
      setBody(payload);
    },
    []
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/site/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardType,
          title,
          content: body.content,
          imageUrls: body.imageUrls,
          imageSizeLevels: body.imageSizeLevels,
        }),
      });
      if (!response.ok) {
        setMessage("실패");
        return;
      }
      router.push(`/site/community/${boardType}`);
    } catch {
      setMessage("실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="v3-stack v3-box" onSubmit={handleSubmit}>
      <label className="v3-stack">
        <span>제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
        />
      </label>
      <div className="v3-stack">
        <div
          className="v3-row"
          style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem", width: "100%" }}
        >
          <span>내용</span>
          <button
            type="button"
            className="v3-btn"
            disabled={loading || attachUi.uploading || attachUi.remaining <= 0}
            style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem", lineHeight: 1.25, flexShrink: 0 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => bodyEditorRef.current?.openImageAttach()}
          >
            {attachUi.uploading ? "업로드…" : "이미지첨부"}
          </button>
        </div>
        <CommunityPostBodyEditor
          ref={bodyEditorRef}
          disabled={loading}
          initialContent=""
          initialImageUrls={[]}
          initialImageSizeLevels={[]}
          onSerializedChange={onBodyChange}
          onAttachUiChange={onAttachUiChange}
        />
      </div>
      <button type="submit" className="v3-btn" disabled={loading} style={{ padding: "0.7rem 1rem", alignSelf: "flex-start" }}>
        {loading ? "저장 중..." : "저장"}
      </button>
      {message ? <p className="v3-muted">{message}</p> : null}
    </form>
  );
}
