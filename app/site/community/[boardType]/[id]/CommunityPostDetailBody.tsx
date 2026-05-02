import type { CSSProperties, ReactNode } from "react";
import { type CommunityPostBodySegment } from "../../../../../lib/community-post-content-images";

type TailItem = { url: string; sizeLevel: number };

/** 커뮤니티 상세: 모든 이미지를 동일 폭(90%) 정책으로 표시 */
function imgStyleUniform(): CSSProperties {
  return {
    width: "100%",
    maxWidth: "none",
    height: "auto",
    objectFit: "contain",
    display: "block",
    margin: 0,
  };
}

type Props = {
  segments: CommunityPostBodySegment[];
  tailImages: TailItem[];
};

export default function CommunityPostDetailBody({ segments, tailImages }: Props) {
  const nodes: ReactNode[] = [];
  const groupedImages: { url: string; key: string }[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.kind === "text") {
      nodes.push(
        <span key={`t-${i}`} className="ui-community-post-body-text">
          {seg.value}
        </span>
      );
      i += 1;
      continue;
    }
    while (i < segments.length && segments[i].kind === "img") {
      const s = segments[i] as Extract<CommunityPostBodySegment, { kind: "img" }>;
      if (s.url) groupedImages.push({ url: s.url, key: `img-${i}` });
      i += 1;
    }
  }

  if (tailImages.length > 0) {
    const imgs = tailImages
      .filter((item) => item.url)
      .map((item, idx) => ({
        url: item.url,
        key: `tail-${idx}-${item.url}`,
      }));
    groupedImages.push(...imgs);
  }

  if (groupedImages.length > 0) {
    nodes.push(<ImageCluster key="c-grouped" images={groupedImages} />);
  }

  return <div className="ui-community-post-body">{nodes}</div>;
}

function ImageCluster({ images }: { images: { url: string; key: string }[] }) {
  return (
    <div className="ui-community-post-images ui-community-post-images--uniform">
      {images.map((img) => (
        <span key={img.key} className="ui-community-post-body-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ui-community-post-inline-img"
            src={img.url}
            alt=""
            loading="lazy"
            decoding="async"
            style={imgStyleUniform()}
          />
        </span>
      ))}
    </div>
  );
}
