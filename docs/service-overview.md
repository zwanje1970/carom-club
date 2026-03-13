# 서비스 개요 (Service Overview)

## CAROM.CLUB Platform

당구 대회 및 클럽 운영을 위한 통합 플랫폼.

### 핵심 기능

- **회원**: 가입/로그인, 마이페이지, 핸디/AVG 증빙 관리
- **조직**: 멀티 조직(클럽/연맹/장소) 및 멤버십
- **대회**: 대회 생성·등록, 규칙(대진표/상금/참가조건) 설정, 참가 신청·결제·대진표·결과
- **커뮤니티**: 게시판/소통
- **관리자**: 대회/참가자/대진표/회원/문의/설정

### 기술 스택

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **DB**: Neon (Serverless PostgreSQL)
- **Storage**: Vercel Blob (이미지/증빙 등)

### 문서 목록

- [도메인 모델](./domain-model.md)
- [대회 엔진](./tournament-engine.md)
- [관리자 플로우](./admin-flow.md)
- [회원 플로우](./member-flow.md)
- [UI 구조](./ui-structure.md)
