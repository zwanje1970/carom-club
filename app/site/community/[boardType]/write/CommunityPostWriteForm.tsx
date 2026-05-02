"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityPostBodyEditor, {
  type CommunityPostBodyEditorHandle,
} from "../../CommunityPostBodyEditor";
import type { CommunityPostImageLayout } from "../../../../../lib/community-post-content-images";
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
  const [imageLayout, setImageLayout] = useState<CommunityPostImageLayout>("full");
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
          imageLayout,
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
    <form className="card-clean ui-community-post-form v3-stack" onSubmit={handleSubmit}>
      <label className="ui-community-form-field v3-stack">
        <span className="ui-community-form-label">제목</span>
        <input
          className="ui-community-form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </label>
      <div className="ui-community-form-field v3-stack">
        <div className="ui-community-form-toolbar">
          <span className="ui-community-form-label">내용</span>
          <button
            type="button"
            className="secondary-button ui-community-post-action-tight"
            disabled={loading || attachUi.remaining <= 0}
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
      <div className="ui-community-form-field v3-stack">
        <span className="ui-community-form-label">첨부 이미지 표시</span>
        <div className="ui-community-image-layout-options" role="group" aria-label="첨부 이미지 표시 방식">
          <label className="ui-community-image-layout-option">
            <input
              type="radio"
              name="imageLayout"
              value="full"
              checked={imageLayout === "full"}
              onChange={() => setImageLayout("full")}
              disabled={loading}
            />
            <span>풀폭 세로형</span>
          </label>
          <label className="ui-community-image-layout-option">
            <input
              type="radio"
              name="imageLayout"
              value="grid2"
              checked={imageLayout === "grid2"}
              onChange={() => setImageLayout("grid2")}
              disabled={loading}
            />
            <span>2장 그리드형</span>
          </label>
        </div>
      </div>
      <button
        type="submit"
        className="primary-button ui-community-post-action-submit"
        disabled={loading || attachUi.uploading || attachUi.pendingImages}
      >
        {loading ? "저장 중..." : "저장"}
      </button>
      {message ? <p className="v3-muted ui-community-form-message">{message}</p> : null}
    </form>
  );
}
