"use client";

import NativeFullscreenOrientationLock from "../../../native-fullscreen-orientation-lock";

/** 신청자 가로보기(table-view) 전용 — landscape-primary 로 노치=왼쪽·제스처=오른쪽 방향 고정(네이티브/브라우저 lock) */
export default function ApplicationsTableOrientationLock() {
  return (
    <NativeFullscreenOrientationLock contextLabel="applications-table-view" landscapeLockMode="landscape-primary" />
  );
}
