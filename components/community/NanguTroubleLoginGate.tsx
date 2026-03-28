"use client";

import { CommunityFeatureLoginGate } from "@/components/community/CommunityFeatureLoginGate";

/** 난구해결사(/community/nangu, /community/trouble) 비로그인 진입 시 */
export function NanguTroubleLoginGate() {
  return (
    <CommunityFeatureLoginGate
      title="난구해결사"
      description="난구해결사는 로그인 후 이용할 수 있습니다."
      titleId="nangu-trouble-login-title"
      fallbackPath="/community/nangu"
    />
  );
}
