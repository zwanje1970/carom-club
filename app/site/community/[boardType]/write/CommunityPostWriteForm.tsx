"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityPostBodyEditor, {
  type CommunityPostBodyEditorHandle,
} from "../../CommunityPostBodyEditor";
import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../../../../../lib/community-post-images";
import type { SiteCommunityBoardKey } from "../../../../../lib/types/entities";
import { communityBoardListHref } from "../../community-tab-config";

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
    pendingImages: false,
  });
  const onAttachUiChange = useCallback((s: { uploading: boolean; remaining: number; pendingImages: boolean }) => {
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
          imageLayout: "full",
        }),
      });
      if (!response.ok) {
        setMessage("실패");
        return;
      }
      const href = communityBoardListHref(boardType as SiteCommunityBoardKey);
      router.push(href);
      router.refresh();
    } catch {
      setMessage("실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="ui-community-post-form ui-community-post-form--plain v3-stack" onSubmit={handleSubmit}>
      <div className="ui-community-compose-topbar">
        <button
          type="button"
          className="ui-community-post-attach-button"
          disabled={loading || attachUi.uploading || attachUi.pendingImages || attachUi.remaining <= 0}
          onClick={() => bodyEditorRef.current?.openImageAttach()}
        >
          {attachUi.uploading ? "업로드…" : "이미지첨부"}
        </button>
        <button
          type="submit"
          className="primary-button ui-community-compose-topbar-submit"
          disabled={loading || attachUi.uploading || attachUi.pendingImages}
        >
          {loading ? "저장 중..." : "저장"}
        </button>
      </div>
      <div className="ui-community-form-field v3-stack">
        <input
          className="ui-community-form-input"
          placeholder="제목"
          aria-label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </div>
      <div className="ui-community-form-field v3-stack">
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
      {message ? <p className="v3-muted ui-community-form-message">{message}</p> : null}
    </form>
  );
}
