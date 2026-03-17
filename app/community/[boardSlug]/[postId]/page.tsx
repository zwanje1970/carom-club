"use client";

import { useParams } from "next/navigation";
import { CommunityPostDetailView } from "@/components/community/CommunityPostDetailView";

export default function CommunityBoardSlugPostDetailPage() {
  const params = useParams();
  const boardSlug = params.boardSlug as string;
  const postId = params.postId as string;
  return (
    <CommunityPostDetailView
      postId={postId}
      linkOverrides={{
        listHref: `/community/${boardSlug}`,
        editHref: `/community/posts/${postId}/edit`,
        deleteRedirect: `/community/${boardSlug}`,
      }}
    />
  );
}
