import { permanentRedirect } from "next/navigation";

/** 구 자동 합산 경로(`/client/settlements`) — 중간 안내 없이 정산 허브로만 이동. */
export default function ClientSettlementsLegacyPathRedirect() {
  permanentRedirect("/client/settlement");
}
