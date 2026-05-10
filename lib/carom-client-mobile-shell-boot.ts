/**
 * `/client` 최초 페인트 전 모바일 앱 셸 판정 — `html[data-mobile-app-shell="1"]` 와 `globals.css` 연동.
 * 서버·미들웨어가 놓친 PWA standalone·iOS 홈 화면·브릿지만 보강(공개 사이트 경로는 즉시 return).
 */

/** `proxy.ts`(/client) → `app/layout.tsx` 요청 헤더로 전달 */
export const CAROM_CLIENT_MOBILE_APP_SHELL_HEADER = "x-carom-client-mobile-app-shell";

export const CAROM_CLIENT_MOBILE_SHELL_BOOT_SCRIPT = `(function(){try{var p=location.pathname||"";var el=document.documentElement;if(p.indexOf("/client")!==0){el.removeAttribute("data-mobile-app-shell");return;}if(el.getAttribute("data-mobile-app-shell")==="1")return;var ua=(navigator.userAgent||"").toLowerCase();if(ua.indexOf("; wv)")!==-1||ua.indexOf("; wv ")!==-1){el.setAttribute("data-mobile-app-shell","1");return;}if(ua.indexOf("caromclubapp")!==-1||ua.indexOf("carom-club-app")!==-1){el.setAttribute("data-mobile-app-shell","1");return;}try{var b=window.CaromAppBridge;if(b!=null&&typeof b==="object"){el.setAttribute("data-mobile-app-shell","1");return;}}catch(e1){}var dm=false;try{dm=window.matchMedia("(display-mode: standalone)").matches;}catch(e2){}var ios=false;try{ios=typeof navigator!=="undefined"&&"standalone"in navigator&&navigator.standalone===true;}catch(e3){}if(dm||ios)el.setAttribute("data-mobile-app-shell","1");}catch(e0){}})();`;
