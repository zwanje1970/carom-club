import Image from "next/image";

/** `public/images/nangu-solver-icon.png` — 메인·난구해결사 UI 아이콘 */
export const NANGU_SOLVER_ICON_PATH = "/images/nangu-solver-icon.png";

type Props = {
  /** 정사각 래퍼 한 변(px) — 값이 커지거나 작아져도 이미지는 비율 유지·잘리지 않음 */
  size?: number;
  /** `size` 대신 쓸 래퍼 한 변(px) */
  frameSize?: number;
  /** 테두리·그림자·둥근 모서리 (이때만 바깥에서 `overflow-hidden`으로 클립) */
  framed?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * 인접 제목·링크가 접근성 텍스트를 제공할 때 장식용(`aria-hidden`).
 * 안쪽 `inset` 영역에 `fill` + `object-contain`을 두어 **크기와 무관하게 잘리지 않고** 가운데에 맞춤.
 */
export function NanguSolverIcon({
  size = 44,
  frameSize,
  framed = false,
  className = "",
  priority = false,
}: Props) {
  const outer = frameSize ?? size;

  const frameClass = framed
    ? "overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
    : "overflow-visible";

  /** 안쪽 `inset-2`(8px×2) — `sizes` 힌트용 */
  const innerApprox = Math.max(outer - 16, 1);

  return (
    <span
      aria-hidden
      className={["relative inline-block shrink-0", frameClass, className].filter(Boolean).join(" ")}
      style={{ width: outer, height: outer }}
    >
      <span className="absolute inset-2 block min-h-0 min-w-0">
        <span className="relative block h-full min-h-0 w-full min-w-0">
          <Image
            src={NANGU_SOLVER_ICON_PATH}
            alt=""
            fill
            sizes={`${innerApprox}px`}
            className="object-contain object-center"
            priority={priority}
            style={{ objectFit: "contain" }}
          />
        </span>
      </span>
    </span>
  );
}
