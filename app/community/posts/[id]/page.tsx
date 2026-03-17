"use client";

import { useParams } from "next/navigation";
import { CommunityPostDetailView } from "@/components/community/CommunityPostDetailView";

export default function CommunityPostDetailPage() {
  const params = useParams();
  const id = params.id as string;
  return <CommunityPostDetailView postId={id} />;
}
