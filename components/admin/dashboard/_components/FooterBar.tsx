"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { CONSOLE_INNER_MAX_CLASS, CONSOLE_PAD_X_CLASS } from "@/lib/console-layout";

type Props = {
  children?: ReactNode;
};

export default function FooterBar({ children }: Props) {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer
      className={`${CONSOLE_INNER_MAX_CLASS} ${CONSOLE_PAD_X_CLASS} border-t border-gray-200 py-3 dark:border-slate-700`}
    >
      <div className="text-center text-sm text-gray-500 dark:text-slate-400">
        <b>&copy;{year ?? ""}</b>
        {children && ` · ${children}`}
      </div>
    </footer>
  );
}
