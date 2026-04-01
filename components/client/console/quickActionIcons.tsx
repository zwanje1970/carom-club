/** 빠른 실행·설정 피드백 박스용 아이콘 (서버/클라이언트 공용) */
export function IconMegaphone({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6l-4 4H4a1 1 0 0 0-1 1z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9a5 5 0 0 1 0 6" strokeLinecap="round" />
      <path d="M17 7a8 8 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  );
}

export function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 8a4 4 0 0 1 8 0v7a4 4 0 1 1-8 0V8z" strokeLinecap="round" />
      <path d="M12 4v2M4 13h3m10 0h3M5 8l2 2m10-2-2 2M5 18l2-2m10 2-2-2" strokeLinecap="round" />
    </svg>
  );
}
