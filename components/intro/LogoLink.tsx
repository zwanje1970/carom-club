"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useIntroController } from "./useIntroController";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

const ballBase = "h-3.5 w-3.5 rounded-full sm:h-4 sm:w-4";

type LogoLinkProps = {
  variant?: "default" | "dark" | "white" | "footer";
  "data-main-logo"?: boolean;
};

export function LogoLink({
  variant = "default",
  "data-main-logo": dataMainLogo,
  ...linkRest
}: LogoLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { restartIntro } = useIntroController();
  const { siteName, logoUrl } = useSiteSettings();

  const handleClick = (e: React.MouseEvent) => {
    if (dataMainLogo) return;
    e.preventDefault();
    restartIntro();
    if (pathname !== "/") router.push("/");
  };

  const isDark = variant === "dark";
  const isWhite = variant === "white";
  const isFooter = variant === "footer";
  const textClass = isFooter
    ? "text-neutral-500"
    : isDark
      ? "text-neutral-700"
      : isWhite
        ? "text-white"
        : "text-site-text";

  if (logoUrl) {
    const imgClass = isFooter ? "h-6 w-auto sm:h-7" : "h-8 w-auto sm:h-9";
    const isSvg = logoUrl.includes(".svg") || logoUrl.toLowerCase().includes("svg");
    return (
      <Link
        href="/"
        onClick={handleClick}
        data-main-logo={dataMainLogo}
        {...linkRest}
        className={`flex items-center gap-1.5 text-lg font-bold tracking-tight sm:text-xl shrink-0 ${textClass}`}
        aria-label={dataMainLogo ? `${siteName} 홈` : `${siteName} 홈 (인트로 다시 보기)`}
      >
        <span className={`relative flex shrink-0 ${imgClass}`} data-logo-balls>
          {isSvg ? (
            /* eslint-disable-next-line @next/next/no-img-element -- SVG from Blob, next/image does not optimize SVG */
            <img src={logoUrl} alt="" className="h-full w-auto object-contain" />
          ) : (
            <Image
              src={logoUrl}
              alt=""
              width={160}
              height={48}
              className="h-full w-auto object-contain"
              sizes="(max-width: 640px) 120px, 160px"
              unoptimized={false}
            />
          )}
        </span>
        <span data-logo-text>{siteName}</span>
      </Link>
    );
  }

  /* 인트로 공 색상과 동일: 첫번째 amber-400, 두번째 red-500, 세번째 white */
  const ball1 = isFooter
    ? "bg-neutral-500"
    : isWhite
      ? "bg-amber-400"
      : isDark
        ? "bg-site-primary"
        : "bg-site-secondary";
  const ball2 = isFooter
    ? "bg-neutral-500"
    : isWhite
      ? "bg-red-500"
      : isDark
        ? "bg-site-primary"
        : "bg-site-primary";
  const ball3 = isFooter
    ? "bg-neutral-500"
    : isWhite
      ? "bg-white"
      : isDark
        ? "bg-neutral-700"
        : "bg-white";

  return (
    <Link
      href="/"
      onClick={handleClick}
      data-main-logo={dataMainLogo}
      {...linkRest}
      className={`flex items-center gap-0.5 text-lg font-bold tracking-tight sm:text-xl shrink-0 ${textClass}`}
      aria-label={dataMainLogo ? `${siteName} 홈` : `${siteName} 홈 (인트로 다시 보기)`}
    >
      <span className="flex items-center gap-1" data-logo-balls>
        <span className={`${ballBase} ${ball1}`} />
        <span className={`${ballBase} ${ball2}`} />
        <span className={`${ballBase} ${ball3}`} />
      </span>
      <span className="ml-1" data-logo-text>{siteName}</span>
    </Link>
  );
}
