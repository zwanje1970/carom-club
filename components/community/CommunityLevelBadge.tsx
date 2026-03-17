"use client";

/**
 * 닉네임 옆에 표시하는 레벨·등급 배지.
 * 프로필, 게시글/댓글/해법 작성자 정보에 공통 사용.
 */
export function CommunityLevelBadge({
  level,
  tierName,
  tierColor,
  className = "",
  size = "default",
}: {
  level: number;
  tierName: string;
  tierColor?: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const color = tierColor ?? "#94a3b8";
  const isHigh = level >= 10;
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${textSize} ${className}`}
      style={{
        backgroundColor: `${color}22`,
        color: color,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: `${color}44`,
      }}
      title={`Lv${level} ${tierName}`}
    >
      <span className="opacity-90">Lv{level}</span>
      <span className="opacity-70">·</span>
      <span className={isHigh ? "font-semibold" : ""}>{tierName}</span>
    </span>
  );
}
