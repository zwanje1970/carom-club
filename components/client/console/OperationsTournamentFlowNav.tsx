"use client";

import Link from "next/link";
import { cx } from "@/components/client/console/ui/cx";

/** operations 하위 대회별 화면 — 상단 공통 이동 (순서: 목록 → 대회관리 → 참가자 → 대진표 → 대진 생성) */
export type OperationsFlowStep = "participants" | "roster" | "bracket-build" | "bracket";

const navBtn =
  "rounded-sm border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap";
const navBtnActive =
  "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 pointer-events-none";
const navBtnIdle =
  "border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800";

type NavItem = {
  key: string;
  href: string;
  label: string;
  step: OperationsFlowStep | null;
};

export function OperationsTournamentFlowNav({
  tournamentId,
  listHref = "/client/operations",
  active,
}: {
  tournamentId: string;
  listHref?: string;
  active: OperationsFlowStep;
}) {
  const info = `/client/tournaments/${tournamentId}`;
  const base = `/client/operations/tournaments/${tournamentId}`;
  const all: NavItem[] = [
    { key: "list", href: listHref, label: "대회관리", step: null },
    { key: "info", href: info, label: "대회관리", step: null },
    { key: "participants", href: `${base}/participants`, label: "참가자 관리", step: "participants" },
    { key: "roster", href: `${base}/participant-roster`, label: "참가 명단 확정", step: "roster" },
    { key: "bracket", href: `${base}/bracket`, label: "대진표 보기·수정", step: "bracket" },
    { key: "build", href: `${base}/bracket-build`, label: "대진 생성", step: "bracket-build" },
  ];

  /** 현재 화면 기준 2~4개만(데스크톱): 목록·대회관리 + 단계별 연관 링크 */
  const desktopKeys: Record<OperationsFlowStep, string[]> = {
    participants: ["list", "info", "participants", "roster"],
    roster: ["list", "info", "roster", "build"],
    "bracket-build": ["list", "info", "roster", "build"],
    bracket: ["list", "info", "build", "bracket"],
  };

  function isActive(it: NavItem): boolean {
    if (it.step === null) return false;
    return it.step === active;
  }

  const desktopItems = all.filter((it) => desktopKeys[active].includes(it.key));
  const primary = all.slice(0, 2);
  const rest = all.slice(2);

  return (
    <div className="space-y-2">
      {/* 모바일: 목록·대회관리 + 나머지는 드롭다운 */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {primary.map((it) => (
          <Link key={it.key} href={it.href} className={cx(navBtn, navBtnIdle)}>
            {it.label}
          </Link>
        ))}
        <details className="relative">
          <summary
            className={cx(
              navBtn,
              navBtnIdle,
              "list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden"
            )}
          >
            운영 단계 ▾
          </summary>
          <div className="absolute left-0 top-full z-30 mt-1 min-w-[13rem] rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-600 dark:bg-zinc-900">
            {rest.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className={cx(
                  "block px-3 py-2 text-[11px] font-medium",
                  isActive(it)
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                )}
              >
                {it.label}
                {isActive(it) ? " · 현재" : ""}
              </Link>
            ))}
          </div>
        </details>
      </div>

      {/* 태블릿 이상: 화면별 4개 */}
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-1.5">
        {desktopItems.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={cx(navBtn, isActive(it) ? navBtnActive : navBtnIdle)}
            aria-current={isActive(it) ? "page" : undefined}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** 이전 / 다음 운영 단계 (참가자 → 명단 → 대진 생성 → 대진표 → 결과) */
export function OperationsStepFlowBar({
  tournamentId,
  activeStep,
  listHref = "/client/operations",
}: {
  tournamentId: string;
  activeStep: OperationsFlowStep;
  listHref?: string;
}) {
  const base = `/client/operations/tournaments/${tournamentId}`;
  const results = `/client/tournaments/${tournamentId}/results`;

  const flow: Record<
    OperationsFlowStep,
    { prev?: { label: string; href: string }; next?: { label: string; href: string } }
  > = {
    participants: {
      prev: { label: "← 대회 목록", href: listHref },
      next: { label: "참가 명단 확정으로 이동 →", href: `${base}/participant-roster` },
    },
    roster: {
      prev: { label: "← 참가자 관리", href: `${base}/participants` },
      next: { label: "대진 생성 콘솔로 이동 →", href: `${base}/bracket-build` },
    },
    "bracket-build": {
      prev: { label: "← 참가 명단 확정", href: `${base}/participant-roster` },
      next: { label: "대진표 보기·수정으로 이동 →", href: `${base}/bracket` },
    },
    bracket: {
      prev: { label: "← 대진 생성 콘솔", href: `${base}/bracket-build` },
      next: { label: "경기 진행 / 결과 입력 →", href: results },
    },
  };

  const { prev, next } = flow[activeStep];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50/90 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {prev ? (
          <Link
            href={prev.href}
            className="text-[11px] font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            {prev.label}
          </Link>
        ) : null}
      </div>
      {next ? (
        <Link
          href={next.href}
          className="inline-flex w-fit items-center rounded-sm border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
        >
          {next.label}
        </Link>
      ) : null}
    </div>
  );
}
