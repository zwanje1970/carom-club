import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** 셸 main이 max-w·좌우 패딩을 담당하므로 섹션은 세로 간격만 */
export default function SectionMain({ children }: Props) {
  return <section className="w-full py-6 first:pt-0">{children}</section>;
}
