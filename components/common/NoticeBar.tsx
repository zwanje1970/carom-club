"use client";

import { SmartLink } from "./SmartLink";
import type { NoticeBar as NoticeBarType } from "@/types/notice-bar";

type Props = {
  bar: NoticeBarType;
};

export function NoticeBar({ bar }: Props) {
  const style = {
    backgroundColor: bar.backgroundColor,
    color: bar.textColor,
  };
  const content = (
    <div
      className="w-full px-4 py-2 text-center text-sm font-medium"
      style={style}
    >
      {bar.message}
    </div>
  );

  const linkable =
    bar.linkType === "internal" && bar.internalPath ||
    bar.linkType === "external" && bar.externalUrl;
  const href =
    bar.linkType === "internal"
      ? bar.internalPath ?? "#"
      : bar.linkType === "external"
        ? bar.externalUrl ?? "#"
        : "#";
  const internal = bar.linkType === "internal";

  const wrapperClass = bar.position === "fixed_top" ? "fixed top-0 left-0 right-0 z-30" : "";

  return (
    <div className={wrapperClass}>
      {linkable ? (
        <SmartLink
          href={href}
          internal={internal}
          openInNewTab={bar.linkType === "external" ? bar.openInNewTab : false}
          className="block w-full"
        >
          {content}
        </SmartLink>
      ) : (
        content
      )}
    </div>
  );
}
