import Link from "next/link";

type Props = {
  href: string;
  label?: string;
};

/** 글쓰기 FAB (우측 하단). 하단 탭 네비(z-50)보다 위에 두고, 모바일은 네비 높이만큼 띄움 */
export function CommunityWriteFab({ href, label = "글쓰기" }: Props) {
  return (
    <Link
      href={href}
      className="fixed right-4 z-[60] flex h-14 min-w-[56px] items-center justify-center rounded-full bg-site-primary px-5 text-sm font-semibold text-white shadow-md hover:opacity-90 active:scale-[0.98] max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 md:right-6"
      aria-label={label}
    >
      <span className="sm:hidden" aria-hidden>
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
