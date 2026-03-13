"use client";

import Link from "next/link";

type SmartLinkProps = {
  href: string;
  internal: boolean; // true = Next.js Link, false = <a>
  openInNewTab?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * 내부 링크: Next.js Link
 * 외부 링크: <a target="_blank" rel="noopener noreferrer"> 등
 */
export function SmartLink({
  href,
  internal,
  openInNewTab = false,
  className,
  children,
}: SmartLinkProps) {
  if (internal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}
