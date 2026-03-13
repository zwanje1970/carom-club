"use client";

import React from "react";

type ChartData = {
  labels?: string[];
  datasets?: unknown[];
};

const ChartLineSample = ({ data }: { data?: ChartData }) => {
  return (
    <div className="h-96 flex items-center justify-center rounded border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/50">
      <span className="text-sm text-gray-500 dark:text-slate-400">
        {data?.labels?.length ? `Chart (${data.labels.length} points)` : "Chart"}
      </span>
    </div>
  );
};

export default ChartLineSample;
