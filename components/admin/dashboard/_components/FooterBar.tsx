"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { containerMaxW } from "../../_lib/config";

type Props = {
  children?: ReactNode;
};

export default function FooterBar({ children }: Props) {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className={`px-6 py-3 ${containerMaxW} border-t border-gray-200 dark:border-slate-700`}>
      <div className="text-center text-sm text-gray-500 dark:text-slate-400">
        <b>&copy;{year ?? ""}</b>
        {children && ` · ${children}`}
      </div>
    </footer>
  );
}
