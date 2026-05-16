"use client";

import { useEffect } from "react";
import {
  logCommunityLoadDiagDetailEnter,
  logCommunityLoadDiagFetchComplete,
  logCommunityLoadDiagFetchStart,
  markCommunityLoadDiagBodyReady,
} from "../../../../../lib/site/community-load-diag";
import SiteDetailShellBodyLoader from "../../../components/SiteDetailShellBodyLoader";

export function CommunityLoadDiagEnter({ postId }: { postId: string }) {
  useEffect(() => {
    logCommunityLoadDiagDetailEnter(postId);
  }, [postId]);
  return null;
}

export function CommunityLoadDiagFetchStart({ kind }: { kind: "config" | "post" | "comments" }) {
  useEffect(() => {
    logCommunityLoadDiagFetchStart(kind);
  }, [kind]);
  return null;
}

export function CommunityLoadDiagConfigComplete({ durationMs }: { durationMs: number }) {
  useEffect(() => {
    logCommunityLoadDiagFetchComplete("config", { durationMs });
  }, [durationMs]);
  return null;
}

export function CommunityLoadDiagPostComplete({
  durationMs,
  titleLength,
  contentLength,
}: {
  durationMs: number;
  titleLength: number;
  contentLength: number;
}) {
  useEffect(() => {
    logCommunityLoadDiagFetchComplete("post", { durationMs, titleLength, contentLength });
  }, [durationMs, titleLength, contentLength]);
  return null;
}

export function CommunityLoadDiagBodyReady() {
  useEffect(() => {
    markCommunityLoadDiagBodyReady();
  }, []);
  return null;
}

export function CommunityDetailSuspenseFallback({
  fetchStarts,
}: {
  fetchStarts?: Array<"config" | "post" | "comments">;
}) {
  return (
    <>
      {fetchStarts?.map((kind) => (
        <CommunityLoadDiagFetchStart key={kind} kind={kind} />
      ))}
      <SiteDetailShellBodyLoader />
    </>
  );
}
