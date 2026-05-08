"use client";

import NativeFullscreenOrientationLock from "../../../native-fullscreen-orientation-lock";

/** 신청자 가로보기(table-view) 전용 — 네이티브 회전 로그 포함 */
export default function ApplicationsTableOrientationLock() {
  return <NativeFullscreenOrientationLock contextLabel="applications-table-view" />;
}
