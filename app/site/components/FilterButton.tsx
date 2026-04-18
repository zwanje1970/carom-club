"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import styles from "./filter-controls.module.css";

export type FilterButtonProps = {
  href: string;
  children: ReactNode;
  /** true 이면 Next.js Link 사용 (클라이언트 네비게이션) */
  useNextLink?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> & {
    className?: string;
  };

export default function FilterButton({ href, children, useNextLink, className, ...rest }: FilterButtonProps) {
  const cls = [styles.button, className].filter(Boolean).join(" ");
  if (useNextLink) {
    return (
      <Link className={cls} href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a className={cls} href={href} {...rest}>
      {children}
    </a>
  );
}
