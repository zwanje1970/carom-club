import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function SectionMain({ children }: Props) {
  return <section className="w-full py-6 first:pt-0">{children}</section>;
}
