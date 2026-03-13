import Link from "next/link";

const ballClass = "rounded-full bg-amber-400";
const ballClassRed = "rounded-full bg-red-500";
const ballClassWhite = "rounded-full bg-white";
const sizeClass = "h-3.5 w-3.5 sm:h-4 sm:w-4";

/** 상단과 동일한 3공 로고 (노랑·빨강·흰색). 링크 없이 표시만 할 때는 asChild 등으로 감싸면 됨. */
export function LogoBalls({ asLink = true }: { asLink?: boolean }) {
  const balls = (
    <span className="flex items-center gap-1" aria-hidden>
      <span className={`${sizeClass} ${ballClass}`} />
      <span className={`${sizeClass} ${ballClassRed}`} />
      <span className={`${sizeClass} ${ballClassWhite}`} />
    </span>
  );
  if (asLink) {
    return <Link href="/" className="inline-flex items-center justify-center" aria-label="CAROM.CLUB 홈">{balls}</Link>;
  }
  return balls;
}
