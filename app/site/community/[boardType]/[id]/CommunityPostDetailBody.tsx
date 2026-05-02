import type { CSSProperties, ReactNode } from "react";
import {
  getCommunityPostLongEdgePx,
  type CommunityPostBodySegment,
  type CommunityPostImageLayout,
} from "../../../../../lib/community-post-content-images";

type TailItem = { url: string; sizeLevel: number };

/** 풀폭 세로: 가로 100% 유지, 세로 나열 */
function imgStyleFullColumn(sizeLevel: number): CSSProperties {
  const px = getCommunityPostLongEdgePx(sizeLevel);
  return {
    maxWidth: "100%",
    maxHeight: `min(70vh, ${px}px)`,
    width: "100%",
    height: "auto",
    objectFit: "contain",
    display: "block",
    margin: 0,
  };
}

/** 그리드 셀 안: 셀 폭에 맞춤 */
function imgStyleGridCell(sizeLevel: number): CSSProperties {
  const px = getCommunityPostLongEdgePx(sizeLevel);
  return {
    maxWidth: "100%",
    maxHeight: `min(70vh, ${px}px)`,
    width: "100%",
    height: "auto",
    objectFit: "contain",
    display: "block",
    margin: 0,
  };
}

type Props = {
  segments: CommunityPostBodySegment[];
  tailImages: TailItem[];
  imageLayout: CommunityPostImageLayout;
};

export default function CommunityPostDetailBody({ segments, tailImages, imageLayout }: Props) {
  const nodes: ReactNode[] = [];
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
    const clusterStart = i;
    const imgs: { url: string; sizeLevel: number; key: string }[] = [];
    while (i < segments.length && segments[i].kind === "img") {
      const s = segments[i] as Extract<CommunityPostBodySegment, { kind: "img" }>;
      if (s.url) imgs.push({ url: s.url, sizeLevel: s.sizeLevel, key: `img-${i}` });
      i += 1;
    }
    if (imgs.length > 0) {
      nodes.push(
        <ImageCluster
          key={`c-${clusterStart}`}
          images={imgs}
          imageLayout={imageLayout}
        />
      );
    }
  }

  if (tailImages.length > 0) {
    const imgs = tailImages
      .filter((item) => item.url)
      .map((item, idx) => ({
        url: item.url,
        sizeLevel: item.sizeLevel,
        key: `tail-${idx}-${item.url}`,
      }));
    if (imgs.length > 0) {
      nodes.push(<ImageCluster key="c-tail" images={imgs} imageLayout={imageLayout} />);
    }
  }

  return <div className="ui-community-post-body">{nodes}</div>;
}

function ImageCluster({
  images,
  imageLayout,
}: {
  images: { url: string; sizeLevel: number; key: string }[];
  imageLayout: CommunityPostImageLayout;
}) {
  const n = images.length;
  const isGrid = imageLayout === "grid2";
  const layoutClass = isGrid ? "ui-community-post-images--grid2" : "ui-community-post-images--full";
  const singleGrid = isGrid && n === 1 ? "ui-community-post-images--grid2-single" : "";

  const styleFor = (sizeLevel: number) => {
    if (!isGrid) return imgStyleFullColumn(sizeLevel);
    return imgStyleGridCell(sizeLevel);
  };

  return (
    <div className={`ui-community-post-images ${layoutClass} ${singleGrid}`.trim()}>
      {images.map((img) => (
        <span key={img.key} className="ui-community-post-body-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ui-community-post-inline-img"
            src={img.url}
            alt=""
            loading="lazy"
            decoding="async"
            style={styleFor(img.sizeLevel)}
          />
        </span>
      ))}
    </div>
  );
}
