"use client";

import React, { ReactNode } from "react";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={className}>{children}</table>;
}

export function TableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <thead className={className}>{children}</thead>;
}

export function TableBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={className}>{children}</tr>;
}

export function TableCell({
  children,
  className,
  isHeader,
}: {
  children: ReactNode;
  className?: string;
  isHeader?: boolean;
}) {
  return isHeader ? (
    <th className={className}>{children}</th>
  ) : (
    <td className={className}>{children}</td>
  );
}
