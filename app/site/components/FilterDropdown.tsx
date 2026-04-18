"use client";

import type { SelectHTMLAttributes } from "react";
import styles from "./filter-controls.module.css";

export type FilterDropdownProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** 그리드 등에서 셀 너비에 맞출 때 */
  fullWidth?: boolean;
};

export default function FilterDropdown({ className, fullWidth, ...rest }: FilterDropdownProps) {
  return (
    <select
      className={[styles.dropdown, fullWidth ? styles.dropdownFullWidth : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
