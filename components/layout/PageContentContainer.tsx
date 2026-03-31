import { cn } from "@/lib/utils";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** 기본 max-w-3xl. 목록/히어로 등 넓은 란은 max-w-5xl. 풀폭은 false */
  maxWidthClass?: string | false;
};

export function PageContentContainer({
  children,
  className,
  maxWidthClass = "max-w-3xl",
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthClass !== false && maxWidthClass,
        PAGE_CONTENT_PAD_X,
        className
      )}
    >
      {children}
    </div>
  );
}
