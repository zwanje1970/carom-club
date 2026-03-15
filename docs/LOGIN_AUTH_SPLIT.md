# 로그인 권한 분기 수정 (일반회원 / 클라이언트 로그인)

## 1. 수정한 파일 목록

| 파일 | 변경 내용 |
|------|------------|
| **types/auth.ts** | `SessionUser`에 `loginMode`, `isClientAccount` 추가. `isClientLoginMode()`, `canAccessClientDashboard()` 헬퍼 추가. |
| **lib/auth.ts** | `getSession()` 반환 시 `loginMode`·`isClientAccount` 정규화(구 JWT 호환: 없으면 `"user"` / role 기준). |
| **app/api/auth/login/route.ts** | 요청 필드 `isClientLogin`(boolean)만 사용. JWT에 `loginMode`·`isClientAccount` 저장. `carom_login_scope` 쿠키 제거. 응답에 `loginMode` 포함. |
| **app/api/auth/logout/route.ts** | `carom_login_scope` 쿠키 삭제 제거(사용 안 함). |
| **app/login/page.tsx** | 전송 필드 `isClientLogin: clientMode`. 리다이렉트는 `data.loginMode === "client"` 기준. 클라이언트 로그인 시 `/client?welcome=1`로 이동. |
| **app/client/layout.tsx** | `canAccessClientDashboard(session)` 사용. 쿠키 제거. `CLIENT_ADMIN`이어도 `loginMode !== "client"`면 `/`로 리다이렉트. |
| **app/client/dashboard/page.tsx** | `searchParams.welcome` 수신. `ClientLoginWelcomeBanner`로 클라이언트 로그인 안내 문구 표시. |
| **components/client/ClientLoginWelcomeBanner.tsx** | 신규. 클라이언트 로그인 시 안내 문구 및 URL에서 `welcome` 제거. |
| **components/layout/MainSiteHeader.tsx** | "클라이언트 대시보드" 링크를 `user?.loginMode === "client"`일 때만 표시. |
| **app/api/client/tournaments/[id]/route.ts** | 권한 검사를 `canAccessClientDashboard(session)`으로 변경. |
| **app/api/client/organization/route.ts** | GET/PATCH 권한 검사를 `canAccessClientDashboard(session)`으로 변경. |
| **app/api/client/organization/promo/route.ts** | GET/PATCH 권한 검사를 `canAccessClientDashboard(session)`으로 변경. |
| **app/api/client/my-billing/route.ts** | 권한 검사를 `canAccessClientDashboard(session)`으로 변경. |
| **app/api/client/my-feature-access/route.ts** | 권한 검사를 `canAccessClientDashboard(session)`으로 변경. |

---

## 2. 기존 원인

- **체크박스와 무관하게 역할만으로 처리**
  - 로그인 API는 `clientLogin`/`clientMode`를 받았지만, 세션에는 **역할(role)** 만 넣고 리다이렉트만 클라이언트에서 체크박스로 분기했음.
  - 클라이언트 영역 접근은 `session.role === "CLIENT_ADMIN"` 또는 쿠키 `carom_login_scope`로만 판단해, **클라이언트 계정이면 로그인 모드와 관계없이** 클라이언트로 취급될 수 있었음.
- **쿠키와 세션 이원화**
  - 로그인 모드를 쿠키(`carom_login_scope`)에만 두고 JWT에는 없어, 서버에서 권한을 볼 때 역할만 보거나 쿠키를 따로 읽어야 했음.
- **리다이렉트만 클라이언트에서 분기**
  - 리다이렉트는 체크박스(`clientMode`)로 했지만, 실제 권한·대시보드 접근·API는 역할/쿠키로만 되어 일관성이 없었음.

---

## 3. 수정 후 동작 요약

- **로그인 요청**
  - 폼에서 `isClientLogin: clientMode`(체크박스 값)만 서버로 전달.
- **서버**
  - 실제로 클라이언트 계정인지 `role === "CLIENT_ADMIN"`으로 검증.
  - `loginMode`: `isClientAccount && isClientLogin === true`일 때만 `"client"`, 아니면 `"user"`.
  - `isClientAccount`: `role === "CLIENT_ADMIN"`.
  - JWT에 `loginMode`, `isClientAccount` 포함해 세션으로 사용. 쿠키는 `carom_session`만 사용.
- **권한**
  - 클라이언트 대시보드/API: `canAccessClientDashboard(session)` (= `role === "CLIENT_ADMIN" && loginMode === "client"`)로만 허용.
- **리다이렉트**
  - 응답의 `loginMode` 기준: `"client"` → `/client?welcome=1`, 그 외 역할에 따라 `/admin`, `/zone`, `/` 등.
- **헤더**
  - "클라이언트 대시보드" 링크는 `loginMode === "client"`일 때만 노출.

---

## 4. 테스트 시나리오

### 일반 로그인 (체크박스 해제)

1. **일반회원(USER)**  
   - 체크 해제 후 로그인 → `loginMode: "user"` → `/` 이동.  
   - 마이페이지·일반 메뉴만 사용. 클라이언트 대시보드 링크 없음.  
   - `/client` 직접 접속 시 로그인 유도 또는 권한 없음 안내.

2. **클라이언트 계정(CLIENT_ADMIN)**  
   - 체크 해제 후 로그인 → `loginMode: "user"` → `/` 이동.  
   - 헤더에 "클라이언트 대시보드" 링크 없음.  
   - `/client` 직접 접속 시 `/`로 리다이렉트.  
   - `/api/client/*` 호출 시 403.

### 클라이언트 로그인 (체크박스 선택)

3. **클라이언트 계정(CLIENT_ADMIN)**  
   - "클라이언트로 로그인" 체크 후 로그인 → `loginMode: "client"` → `/client?welcome=1` 이동.  
   - 대시보드 상단에 "클라이언트 계정으로 로그인되었습니다. 프로젝트 관리는 클라이언트 대시보드를 이용하세요." 표시.  
   - 헤더에 "클라이언트 대시보드" 링크 표시.  
   - `/client/*`, `/api/client/*` 정상 이용.

4. **일반회원(USER)**  
   - 체크 후 로그인 시도 → 서버에서 403 "클라이언트 계정이 아닙니다. '클라이언트로 로그인' 체크를 해제한 후 다시 로그인하세요."  
   - 일반회원은 어떤 경우에도 `loginMode: "client"`가 되지 않음.

---

## 5. 참고

- **구 JWT 호환**  
  - `loginMode`/`isClientAccount`가 없는 기존 세션은 `getSession()`에서 `loginMode: "user"`, `isClientAccount: role === "CLIENT_ADMIN"`으로 채움.  
  - 따라서 예전 세션은 모두 일반 로그인으로 취급되며, 클라이언트 기능은 재로그인(체크 후)해야 사용 가능.
- **미들웨어**  
  - `/client` 경로는 기존처럼 미들웨어에서 별도 리다이렉트하지 않고, `app/client/layout.tsx`에서 `canAccessClientDashboard(session)`으로 접근 제어.
- **admin 로그인**  
  - `/admin/login`은 동일 `POST /api/auth/login`에 `platformAdminOnly: true`만 보내므로 `isClientLogin` 미전달 → `loginMode: "user"`, 플랫폼 관리자만 통과.
