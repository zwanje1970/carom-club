import { createHash, randomUUID } from "crypto";
import { copyFile, mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { AuthRole } from "../auth/roles";
import { normalizeRepresentativeImageUrls, parseTypeSpecific, resolveVenuePricingType } from "../client-organization-setup-parse";
import type { VenuePricingType, VenueSpecific } from "../client-organization-setup-types";
import { isEmptyOutlineHtml } from "../outline-content-helpers";
import type { OutlineDisplayMode } from "../outline-content-types";
import { isValidSiteVenueId, SITE_VENUES } from "../site-venues-catalog";
import { computeLedgerTotalsFromLines, isSettlementCategoryV2 } from "../settlement-ledger-v2";
import type {
  TournamentDivisionMetricType,
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentEligibilityType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../tournament-rule-types";
import { computeLegacyAutoSettlementSummary } from "./settlement-legacy-summary";
import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../community-post-images";
import { normalizeCommunityPostImageSizeLevels } from "../community-post-content-images";
import { tournamentStatusEligibleForMainSlide } from "../site-tournament-badges";
import {
  firestoreCreateUser,
  firestoreFindByLoginIdAndPhoneDigits,
  firestoreFindByLoginIdNorm,
  firestoreFindByPhoneDigits,
  firestoreGetUserById,
  firestoreHasDuplicateIdentity,
  firestoreHasOtherUserWithPhoneDigits,
  firestoreIsNicknameKeyTaken,
  firestoreReplaceUser,
  firestoreUpdatePassword,
  isFirestoreUsersBackendConfigured,
} from "./firestore-users";
import {
  readPlatformOperationSettingsRawFromFirestoreKv,
  resolvePlatformOperationSettingsReadStrategy,
  resolvePlatformOperationSettingsWriteStrategy,
  throwPlatformOperationSettingsWritePersistenceBlocked,
  upsertPlatformOperationSettingsToFirestoreKv,
} from "./platform-operation-settings";
import {
  readSiteCommunityConfigRawFromFirestoreKv,
  resolveSiteCommunityConfigReadStrategy,
  resolveSiteCommunityConfigWriteStrategy,
  throwSiteCommunityConfigWritePersistenceBlocked,
  upsertSiteCommunityConfigToFirestoreKv,
} from "./platform-site-community-settings";
import {
  readSiteLayoutConfigRawFromFirestoreKv,
  resolveSiteLayoutConfigReadStrategy,
  resolveSiteLayoutConfigWriteStrategy,
  throwSiteLayoutConfigWritePersistenceBlocked,
  upsertSiteLayoutConfigToFirestoreKv,
} from "./platform-site-layout-settings";
import {
  readSiteNoticeRawFromFirestoreKv,
  resolveSiteNoticeReadStrategy,
  resolveSiteNoticeWriteStrategy,
  throwSiteNoticeWritePersistenceBlocked,
  upsertSiteNoticeToFirestoreKv,
} from "./platform-site-notice-settings";

export type {
  TournamentDivisionMetricType,
  TournamentDurationType,
  TournamentEntryQualificationType,
  TournamentEligibilityType,
  TournamentScope,
  TournamentTeamScoreRule,
  TournamentVerificationMode,
} from "../tournament-rule-types";

export type ClientApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ClientRequestedType = "GENERAL" | "REGISTERED";
export type ClientOrganizationType = "GENERAL" | "REGISTERED";
export type ClientOrganizationApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ClientOrganizationStatus = "ACTIVE" | "SUSPENDED" | "EXPELLED";
export type ClientMembershipType = "NONE" | "ANNUAL";
export type PlatformUserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type DevUser = {
  id: string;
  loginId: string;
  /** 게시판 등 표시용. 구 데이터 없으면 로드 시 loginId로 채움 */
  nickname: string;
  name: string;
  email: string | null;
  phone: string | null;
  password: string;
  role: AuthRole;
  status?: PlatformUserStatus;
  createdAt: string;
  updatedAt: string;
  /** 클라이언트 소속 당구장(사이트 당구장 ID). 대회 장소 CTA 기본 연결. 없으면 null */
  linkedVenueId: string | null;
  /** 마케팅·안내 푸시 수신 동의. 구 데이터 없으면 true로 간주 */
  pushMarketingAgreed: boolean;
};

export type PlatformUserListItem = {
  id: string;
  name: string;
  loginId: string;
  email: string | null;
  role: AuthRole;
  status: PlatformUserStatus;
  orgClientType: ClientOrganizationType | null;
  orgApprovalStatus: ClientOrganizationApprovalStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientApplication = {
  id: string;
  userId: string;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  requestedClientType: ClientRequestedType;
  status: ClientApplicationStatus;
  rejectedReason: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 클라이언트 사업장 설정(v2 organization 대응, dev-store 영속) */
export type ClientOrganizationStored = {
  clientUserId: string;
  id: string;
  slug: string;
  name: string;
  type: string;
  shortDescription: string | null;
  description: string | null;
  fullDescription: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** 도로명 주소(다음 주소 API 등) */
  address: string | null;
  addressDetail: string | null;
  /** 지번 주소 */
  addressJibun: string | null;
  /** 우편번호 */
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  addressNaverMapEnabled: boolean | null;
  region: string | null;
  typeSpecificJson: string | null;
  clientType: ClientOrganizationType;
  approvalStatus: ClientOrganizationApprovalStatus;
  status: ClientOrganizationStatus;
  adminRemarks: string | null;
  membershipType: ClientMembershipType;
  membershipExpireAt: string | null;
  isPublished: boolean;
  setupCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 클라이언트 → 플랫폼 전용 문의(사이트 커뮤니티와 분리) */
export type ClientInquiryType = "ERROR" | "FEATURE";
export type ClientInquiryStatus = "OPEN" | "CHECKED" | "DONE";

export type ClientInquiryStored = {
  id: string;
  clientUserId: string;
  /** 승인된 조직이 있으면 해당 id, 없으면 null */
  clientOrganizationId: string | null;
  type: ClientInquiryType;
  title: string;
  body: string;
  imageUrls: string[];
  status: ClientInquiryStatus;
  createdAt: string;
  updatedAt: string;
};

export const MAX_CLIENT_INQUIRY_IMAGES = 10;

/** 문의 1건에 달리는 1:1 대화 로그(운영 ↔ 클라이언트) */
export type ClientInquiryCommentAuthorRole = "CLIENT" | "PLATFORM";

export type ClientInquiryCommentStored = {
  id: string;
  inquiryId: string;
  authorRole: ClientInquiryCommentAuthorRole;
  authorUserId: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
};

export const MAX_CLIENT_INQUIRY_COMMENT_IMAGES = 5;

export type ClientInquiryCommentView = {
  id: string;
  authorRole: ClientInquiryCommentAuthorRole;
  authorLabel: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
};

export type PlatformOperationSettings = {
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
  updatedAt: string;
};

/** 클라이언트 당구장 소개(요강 편집기와 동일 필드, 대회와 별도 저장) */
export type ClientVenueIntroStored = {
  clientUserId: string;
  outlineDisplayMode: OutlineDisplayMode | null;
  outlineHtml: string | null;
  outlineImageUrl: string | null;
  outlinePdfUrl: string | null;
  updatedAt: string;
};

export type TournamentDivisionRuleRow = {
  name: string;
  min: number | null;
  max: number | null;
};

/** 기본 장소 외 합동·전국 등 추가 개최 장소 */
export type TournamentExtraVenueRow = {
  address: string;
  name: string;
  phone: string;
};

export type TournamentRuleSnapshot = {
  entryCondition: string | null;
  entryQualificationType: TournamentEntryQualificationType;
  verificationMode: TournamentVerificationMode;
  verificationReviewRequired: boolean;
  verificationGuideText: string | null;
  eligibilityType: TournamentEligibilityType;
  eligibilityValue: number | null;
  /** 참가 조건·OCR 기준의 이하(≤) / 미만(&lt;) */
  eligibilityCompare: TournamentTeamScoreRule;
  divisionEnabled: boolean;
  divisionMetricType: TournamentDivisionMetricType;
  divisionRulesJson: TournamentDivisionRuleRow[] | null;
  scope: TournamentScope;
  region: string | null;
  nationalTournament: boolean;
  accountNumber: string | null;
  allowMultipleSlots: boolean;
  participantsListPublic: boolean;
  durationType: TournamentDurationType;
  /** `MULTI_DAY`일 때만 2~10 */
  durationDays: number | null;
  isScotch: boolean;
  teamScoreLimit: number | null;
  teamScoreRule: TournamentTeamScoreRule;
};

/** 클라이언트 수동 설정 대회 노출 상태(게시카드 배지·메인 노출 필터에 사용) */
export type TournamentStatusBadge =
  | "모집중"
  | "마감임박"
  | "마감"
  | "대기자모집"
  | "예정"
  | "종료"
  | "초안";

const TOURNAMENT_STATUS_BADGE_VALUES: TournamentStatusBadge[] = [
  "모집중",
  "마감임박",
  "마감",
  "대기자모집",
  "예정",
  "종료",
  "초안",
];

export function normalizeTournamentStatusBadge(raw: unknown): TournamentStatusBadge {
  if (typeof raw === "string" && TOURNAMENT_STATUS_BADGE_VALUES.includes(raw as TournamentStatusBadge)) {
    return raw as TournamentStatusBadge;
  }
  return "초안";
}

export type Tournament = {
  id: string;
  title: string;
  date: string;
  /** 복수 일정(YYYY-MM-DD, 오름차순). null이면 단일 `date`만 사용(하위 호환) */
  eventDates: string[] | null;
  location: string;
  /** 기본 장소 외 추가 대회장(빈 항목은 저장·표시 시 제외) */
  extraVenues: TournamentExtraVenueRow[] | null;
  maxParticipants: number;
  entryFee: number;
  createdBy: string;
  createdAt: string;
  /** 대회 포스터(640px 경로 등), 없으면 null */
  posterImageUrl: string | null;
  /** 대회 상태 배지(기본 초안) */
  statusBadge: TournamentStatusBadge;
  /** 대회 한 줄·짧은 안내말 */
  summary: string | null;
  /** 상금 안내(여러 줄 텍스트, v2 prizeInfo와 동일한 용도) */
  prizeInfo: string | null;
  /** 경기요강 등: 사이트에 노출할 방식(직접입력/이미지/PDF). 없으면 null */
  outlineDisplayMode: OutlineDisplayMode | null;
  /** 직접입력 본문(HTML). 표시 방식을 바꿔도 삭제하지 않음 */
  outlineHtml: string | null;
  outlineImageUrl: string | null;
  outlinePdfUrl: string | null;
  /** 사이트 당구장안내 상세(`/site/venues/{id}`)로 연결할 당구장 ID. 없으면 null */
  venueGuideVenueId: string | null;
  /** 없는 구 데이터는 로드 시 기본값으로 채움 */
  rule: TournamentRuleSnapshot;
};

export type TournamentApplicationStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "APPROVED"
  | "REJECTED";

export type TournamentApplicationOcrStatus =
  | "NOT_REQUESTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type TournamentApplication = {
  id: string;
  tournamentId: string;
  userId: string;
  applicantName: string;
  phone: string;
  depositorName: string;
  proofImageId: string;
  proofImage320Url: string;
  proofImage640Url: string;
  proofOriginalUrl: string;
  ocrStatus: TournamentApplicationOcrStatus;
  ocrText: string;
  ocrRawResult: string;
  ocrRequestedAt: string | null;
  ocrCompletedAt: string | null;
  status: TournamentApplicationStatus;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
};

export type BracketParticipantSnapshotParticipant = {
  userId: string;
  applicantName: string;
  phone: string;
};

export type BracketParticipantSnapshot = {
  id: string;
  tournamentId: string;
  participants: BracketParticipantSnapshotParticipant[];
  createdAt: string;
};

export type BracketPlayer = {
  userId: string;
  name: string;
};

export type BracketMatchStatus = "PENDING" | "COMPLETED";
export type BracketRoundStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type BracketMatch = {
  id: string;
  player1: BracketPlayer;
  player2: BracketPlayer;
  winnerUserId: string | null;
  winnerName: string | null;
  status: BracketMatchStatus;
};

export type BracketRound = {
  roundNumber: number;
  matches: BracketMatch[];
  status: BracketRoundStatus;
};

export type Bracket = {
  id: string;
  tournamentId: string;
  snapshotId: string;
  rounds: BracketRound[];
  createdAt: string;
};

export type BracketDraftMatchInput = {
  player1: BracketPlayer;
  player2: BracketPlayer;
};

type MutableBracketMatch = BracketMatch & {
  status?: BracketMatchStatus;
  winnerUserId?: string | null;
  winnerName?: string | null;
};

type MutableBracketRound = BracketRound & {
  status?: BracketRoundStatus;
  matches: MutableBracketMatch[];
};

type MutableBracket = Bracket & {
  rounds: MutableBracketRound[];
};

export type MainCardTemplateType = "tournament" | "venue";

/** 대회 게시 스냅샷에 기록되는 templateId (고정) */
const TOURNAMENT_SNAPSHOT_TEMPLATE_ID = "main-card-template-tournament";

export type SiteLayoutMenuItem = {
  label: string;
  href: string;
};

export type SiteLayoutConfig = {
  header: {
    pc: {
      menuItems: SiteLayoutMenuItem[];
    };
    mobile: {
      menuItems: SiteLayoutMenuItem[];
    };
  };
  footer: {
    pc: {
      text: string;
    };
    mobile: {
      text: string;
    };
  };
};

export type SiteNotice = {
  enabled: boolean;
  text: string;
};

export type SiteCommunityBoardKey = "free" | "qna" | "reviews" | "extra1" | "extra2";

export type SiteCommunityBoardConfig = {
  visible: boolean;
  label: string;
  order: number;
};

export type SiteCommunityConfig = {
  free: SiteCommunityBoardConfig;
  qna: SiteCommunityBoardConfig;
  reviews: SiteCommunityBoardConfig;
  extra1: SiteCommunityBoardConfig;
  extra2: SiteCommunityBoardConfig;
};

export { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../community-post-images";

/** 커뮤니티 게시판 공통 글 (boardType으로 게시판 구분) */
export type CommunityBoardPost = {
  id: string;
  boardType: SiteCommunityBoardKey;
  title: string;
  content: string;
  /** w640 등 표시용 URL (원본 URL 저장 금지) */
  imageUrls: string[];
  /** imageUrls와 동일 순서·길이, 긴변 단계(0~4) */
  imageSizeLevels: number[];
  authorUserId: string;
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
  isDeleted?: boolean;
};

/** 목록 조회 전용(가벼운 필드) */
export type CommunityPostListItem = {
  id: string;
  /** 목록·링크용 — 전체 탭에서 글별 상세 경로 구분 */
  boardType: SiteCommunityBoardKey;
  title: string;
  nickname: string;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  /** 첫 번째 이미지 URL(없으면 null) — 목록 썸네일용 */
  thumbnailUrl: string | null;
};

/** 상세 조회 전용 */
export type CommunityPostDetail = {
  id: string;
  boardType: SiteCommunityBoardKey;
  title: string;
  content: string;
  imageUrls: string[];
  imageSizeLevels: number[];
  authorUserId: string;
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorUserId: string;
  authorNickname: string;
  content: string;
  createdAt: string;
  isDeleted?: boolean;
};

export type CommunityCommentListItem = {
  id: string;
  authorUserId: string;
  authorNickname: string;
  content: string;
  createdAt: string;
};

export type CardSnapshotSourceType = "TOURNAMENT_SNAPSHOT" | "VENUE_SNAPSHOT";

/** 메인 슬라이드 등 2:1 카드 시각 템플릿 */
export type SlideCardTemplateKey = "classic" | "frame";

export function normalizeSlideCardTemplate(v: unknown): SlideCardTemplateKey {
  if (v === "frame") return "frame";
  /* 과거 cinema 저장분은 클래식으로 수렴 */
  return "classic";
}

/** 클라이언트 대회 게시카드 v2 (저장 전용) */
export type TournamentCardTemplate = "A" | "B";
export type TournamentCardBackground = "image" | "theme";
export type TournamentCardTheme = "dark" | "light" | "natural";

export type TournamentPublishedCard = {
  snapshotId: string;
  tournamentId: string;
  title: string;
  textLine1: string | null;
  textLine2: string | null;
  templateType: TournamentCardTemplate;
  backgroundType: TournamentCardBackground;
  themeType: TournamentCardTheme;
  image320Url: string;
  imageId: string;
  status: string;
  targetDetailUrl: string;
  publishedAt: string;
  updatedAt: string;
  isPublished: boolean;
  isActive: boolean;
  version: number;
  publishedBy: string;
  /** 메인 홈 슬라이드에 노출(저장 시점 대회 상태·동기화로 결정, 사이트는 재판단하지 않음) */
  showOnMainSlide: boolean;
  deadlineSortValue?: string;
  /** 이미지 뒤 깔리는 CSS background (색·그라데이션). 저장된 행에만 존재 */
  mediaBackground?: string | null;
  imageOverlayBlend?: boolean | null;
  imageOverlayOpacity?: number | null;
  /** 카드 하단 날짜·장소 표시(대회 기본값에서 수정 가능) */
  cardDisplayDate?: string | null;
  cardDisplayLocation?: string | null;
};

export type PublishedCardSnapshot = {
  snapshotId: string;
  tournamentId: string;
  snapshotSourceType: CardSnapshotSourceType;
  templateType: MainCardTemplateType;
  templateId: string;
  /** 메인 슬라이드 카드 레이아웃(미설정·과거 데이터는 classic) */
  slideCardTemplate?: SlideCardTemplateKey;
  /** 대회 카드 v2: 메인 슬라이드 분기 */
  tournamentCardTemplate?: TournamentCardTemplate;
  tournamentBackgroundType?: TournamentCardBackground;
  tournamentTheme?: TournamentCardTheme;
  /** 대회 스냅샷: 발행 시점 대회 상태 배지(미설정 시 과거 데이터는 제목 파싱) */
  statusBadge?: TournamentStatusBadge;
  /** 대회 카드: 제목과 날짜 사이 자유 문구(각 최대 1줄 권장) */
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  /** 미디어 영역 배경(CSS). 스냅샷에만 선택적으로 저장 */
  tournamentMediaBackground?: string | null;
  tournamentImageOverlayBlend?: boolean | null;
  tournamentImageOverlayOpacity?: number | null;
  tournamentCardDisplayDate?: string | null;
  tournamentCardDisplayLocation?: string | null;
  title: string;
  subtitle: string;
  imageId: string;
  image320Url: string;
  image640Url: string;
  textLayout: string;
  imageLayout: string;
  publishedAt: string;
  targetDetailUrl: string;
  deadlineSortValue?: string;
  isPublished: boolean;
  version: number;
  isActive: boolean;
  updatedAt: string;
  publishedBy: string;
};

export type SitePageBuilderDraftBlock = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export type SitePageBuilderDraftSection = {
  id: string;
  order: number;
  blocks: SitePageBuilderDraftBlock[];
};

export type SitePageBuilderDraft = {
  pageId: string;
  sections: SitePageBuilderDraftSection[];
  savedAt: string;
  savedBy: string;
};

export type SitePageBuilderPublishedPage = {
  pageId: string;
  sections: SitePageBuilderDraftSection[];
  publishedAt: string;
  publishedBy: string;
};

export type SettlementExpenseItem = {
  id: string;
  title: string;
  amount: number;
};

/** v2 장부 라인(저장소) */
export type SettlementLedgerLineStored = {
  id: string;
  category: string;
  flow: string;
  amountKrw: number;
  label: string | null;
  note: string | null;
  sortOrder: number;
  /** YYYY-MM-DD 기록일(없으면 과거 데이터) */
  entryDate?: string | null;
};

export type TournamentSettlement = {
  tournamentId: string;
  refundedApplicationIds: string[];
  expenseItems: SettlementExpenseItem[];
  /** v2 라인 장부(자동 참가비 합산과 무관) */
  ledgerLines: SettlementLedgerLineStored[];
  isSettled: boolean;
  updatedAt: string;
};

export type UserNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  relatedTournamentId: string | null;
  createdAt: string;
  isRead: boolean;
};

/** 브라우저 Web Push Subscription 저장(사용자당 여러 endpoint — 기기별) — 웹푸시 비활성화, 데이터 호환만 */
export type WebPushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  createdAt: string;
  updatedAt: string;
};

/** FCM 앱 푸시용 디바이스 토큰(사용자당 여러 토큰) */
export type FcmDeviceTokenRecord = {
  id: string;
  userId: string;
  token: string;
  platform: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProofImageAsset = {
  id: string;
  uploaderUserId: string;
  originalExt: "jpg" | "png" | "webp";
  createdAt: string;
  /** 사이트 공개용(대회 포스터 등). true면 /api/site-images 로 제공 */
  sitePublic?: boolean;
};

/** 클라이언트 업로드 경기요강·소개 문서 (data/outline-pdfs 파일과 대응) */
export type OutlinePdfAsset = {
  id: string;
  uploaderUserId: string;
  createdAt: string;
  /** 없으면 기존 데이터와 동일하게 `.pdf` 파일로 간주 */
  fileKind?: "pdf" | "docx";
};

export type AuditLog = {
  id: string;
  actorUserId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

type DevStore = {
  users: DevUser[];
  /** 이전 userId → 현재 userId (세션 쿠키·구 데이터 id가 바뀐 뒤에도 조회 가능) */
  legacyUserIdAliases?: Record<string, string>;
  clientApplications: ClientApplication[];
  tournaments: Tournament[];
  tournamentApplications: TournamentApplication[];
  bracketParticipantSnapshots: BracketParticipantSnapshot[];
  brackets: Bracket[];
  settlements: TournamentSettlement[];
  notifications: UserNotification[];
  proofImages: ProofImageAsset[];
  outlinePdfAssets: OutlinePdfAsset[];
  auditLogs: AuditLog[];
  siteLayoutConfig: SiteLayoutConfig;
  siteNotice: SiteNotice;
  siteCommunityConfig: SiteCommunityConfig;
  platformOperationSettings: PlatformOperationSettings;
  publishedCardSnapshots: PublishedCardSnapshot[];
  /** 대회 게시카드 v2 — tournamentId당 버전 나열, active는 메인 노출 1개 */
  tournamentPublishedCards: TournamentPublishedCard[];
  sitePageBuilderDrafts: SitePageBuilderDraft[];
  sitePageBuilderPublishedPages: SitePageBuilderPublishedPage[];
  webPushSubscriptions: WebPushSubscriptionRecord[];
  fcmDeviceTokens: FcmDeviceTokenRecord[];
  clientOrganizations: ClientOrganizationStored[];
  clientVenueIntros: ClientVenueIntroStored[];
  communityPosts: CommunityBoardPost[];
  communityComments: CommunityComment[];
  clientInquiries: ClientInquiryStored[];
  inquiryComments: ClientInquiryCommentStored[];
};

const DEV_STORE_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR_PATH = path.resolve(DEV_STORE_MODULE_DIR, "../../data");
const STORE_FILE_PATH = path.join(STORE_DIR_PATH, "v3-dev-store.json");
/** 저장 직전 메인 파일 덮어쓰기용 단일 백업(파싱 성공한 내용만 복사) */
const STORE_BACKUP_PATH = path.join(STORE_DIR_PATH, "v3-dev-store.json.backup");
const STORE_BACKUP_TIMESTAMP_PATH = path.join(STORE_DIR_PATH, "v3-dev-store.json.backup.timestamp");
/** 메인 파일이 깨졌을 때 우선 복구에 사용하는 마지막 정상 스냅샷(원자적 저장으로 갱신) */
const STORE_LAST_GOOD_PATH = path.join(STORE_DIR_PATH, "v3-dev-store.json.last-good.json");

/**
 * 로컬 v3-dev-store.json 기반 영속 쓰기 허용 여부.
 * 운영(NODE_ENV=production)에서는 읽기만 하고 파일·tmp·백업 쓰기는 하지 않는다.
 */
export function isDevStoreFilePersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** 운영(production) + Firebase 자격 증명이 있을 때만: 회원·로그인 사용자 레코드는 Firestore, dev-store JSON 사용자 테이블은 보조(시드 관리자 등) */
function useFirestoreUsersInProduction(): boolean {
  return process.env.NODE_ENV === "production" && isFirestoreUsersBackendConfigured();
}

/** dev-store JSON 파일 접근 직렬화(동시 rename/read·쓰기로 인한 Windows EBUSY 완화). 내부는 writeStoreImpl로 재진입 없이 처리. */
let storeIoChain: Promise<void> = Promise.resolve();
const STORE_IO_READ_RETRY_DELAYS_MS = [12, 28, 60];
const STORE_IO_WRITE_RETRY_DELAYS_MS = [10, 24, 48];
const STORE_IO_RENAME_RETRY_DELAYS_MS = [8, 18, 36];

function runStoreIoExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = storeIoChain.then(() => task());
  storeIoChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetriableFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code ?? "";
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

function looksLikeIncompleteJson(content: string): boolean {
  const t = content.trim();
  if (!t) return true;
  if (t.startsWith("{") && !t.endsWith("}")) return true;
  if (t.startsWith("[") && !t.endsWith("]")) return true;
  return false;
}

function isRetriableJsonParseError(err: unknown, content: string): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const message = String(err.message || "");
  if (message.includes("Unexpected end of JSON input")) return true;
  if (message.includes("Unexpected token") && looksLikeIncompleteJson(content)) return true;
  return false;
}

const DEFAULT_PLATFORM_ADMIN_LOGIN_ID = "admin";
const DEFAULT_PLATFORM_ADMIN_EMAIL = "zwanje@naver.com";
const DEFAULT_PLATFORM_ADMIN_PASSWORD = "admin1234";
const DEFAULT_PLATFORM_ADMIN_NAME = "플랫폼 관리자";

function createDefaultSiteLayoutConfig(): SiteLayoutConfig {
  const defaultMenuItems: SiteLayoutMenuItem[] = [
    { label: "메인", href: "/site" },
    { label: "대회안내", href: "/site/tournaments" },
    { label: "당구장안내", href: "/site/venues" },
    { label: "커뮤니티", href: "/site/community" },
    { label: "마이페이지", href: "/site/mypage" },
    { label: "플랫폼관리자", href: "/admin" },
  ];

  return {
    header: {
      pc: { menuItems: [...defaultMenuItems] },
      mobile: { menuItems: [...defaultMenuItems] },
    },
    footer: {
      pc: { text: "캐롬클럽 플랫폼\n고객센터 1588-0000 · 운영시간 09:00~18:00" },
      mobile: { text: "캐롬클럽 플랫폼\n고객센터 1588-0000" },
    },
  };
}

function createDefaultSiteNotice(): SiteNotice {
  return {
    enabled: false,
    text: "",
  };
}

function createDefaultSiteCommunityConfig(): SiteCommunityConfig {
  return {
    free: { visible: true, label: "자유게시판", order: 1 },
    qna: { visible: true, label: "QnA", order: 2 },
    reviews: { visible: true, label: "대회후기", order: 3 },
    extra1: { visible: false, label: "예비게시판 1", order: 4 },
    extra2: { visible: false, label: "예비게시판 2", order: 5 },
  };
}

function createDefaultPlatformOperationSettings(): PlatformOperationSettings {
  return {
    annualMembershipVisible: false,
    annualMembershipEnforced: false,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSiteLayoutMenuItems(input: unknown, fallback: SiteLayoutMenuItem[]): SiteLayoutMenuItem[] {
  if (!Array.isArray(input)) return fallback;
  const normalized = input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { label?: unknown; href?: unknown };
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const href = typeof row.href === "string" ? row.href.trim() : "";
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((item): item is SiteLayoutMenuItem => item !== null);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeSiteLayoutConfig(input: unknown): SiteLayoutConfig {
  const fallback = createDefaultSiteLayoutConfig();
  if (!input || typeof input !== "object") return fallback;

  const row = input as {
    header?: {
      pc?: { menuItems?: unknown };
      mobile?: { menuItems?: unknown };
    };
    footer?: {
      pc?: { text?: unknown };
      mobile?: { text?: unknown };
    };
  };

  const headerPcMenuItems = normalizeSiteLayoutMenuItems(row.header?.pc?.menuItems, fallback.header.pc.menuItems);
  const headerMobileMenuItems = normalizeSiteLayoutMenuItems(
    row.header?.mobile?.menuItems,
    fallback.header.mobile.menuItems
  );
  const footerPcTextRaw = row.footer?.pc?.text;
  const footerMobileTextRaw = row.footer?.mobile?.text;
  const footerPcText =
    typeof footerPcTextRaw === "string" && footerPcTextRaw.trim() ? footerPcTextRaw.trim() : fallback.footer.pc.text;
  const footerMobileText =
    typeof footerMobileTextRaw === "string" && footerMobileTextRaw.trim()
      ? footerMobileTextRaw.trim()
      : fallback.footer.mobile.text;

  return {
    header: {
      pc: { menuItems: headerPcMenuItems },
      mobile: { menuItems: headerMobileMenuItems },
    },
    footer: {
      pc: { text: footerPcText },
      mobile: { text: footerMobileText },
    },
  };
}

function normalizeSiteNotice(input: unknown): SiteNotice {
  const fallback = createDefaultSiteNotice();
  if (!input || typeof input !== "object") return fallback;
  const row = input as { enabled?: unknown; text?: unknown };
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : fallback.enabled,
    text: typeof row.text === "string" ? row.text.trim() : fallback.text,
  };
}

function normalizeSiteCommunityBoardConfig(
  input: unknown,
  fallback: SiteCommunityBoardConfig
): SiteCommunityBoardConfig {
  if (!input || typeof input !== "object") return fallback;
  const row = input as { visible?: unknown; label?: unknown; order?: unknown };
  return {
    visible: typeof row.visible === "boolean" ? row.visible : fallback.visible,
    label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : fallback.label,
    order: Number.isFinite(Number(row.order)) ? Math.max(1, Math.floor(Number(row.order))) : fallback.order,
  };
}

function normalizeSiteCommunityConfig(input: unknown): SiteCommunityConfig {
  const fallback = createDefaultSiteCommunityConfig();
  if (!input || typeof input !== "object") return fallback;
  const row = input as Partial<Record<SiteCommunityBoardKey, unknown>>;
  return {
    free: normalizeSiteCommunityBoardConfig(row.free, fallback.free),
    qna: normalizeSiteCommunityBoardConfig(row.qna, fallback.qna),
    reviews: normalizeSiteCommunityBoardConfig(row.reviews, fallback.reviews),
    extra1: normalizeSiteCommunityBoardConfig(row.extra1, fallback.extra1),
    extra2: normalizeSiteCommunityBoardConfig(row.extra2, fallback.extra2),
  };
}

function normalizePlatformOperationSettings(input: unknown): PlatformOperationSettings {
  const fallback = createDefaultPlatformOperationSettings();
  if (!input || typeof input !== "object") return fallback;
  const row = input as { annualMembershipVisible?: unknown; annualMembershipEnforced?: unknown; updatedAt?: unknown };
  const annualMembershipEnforced =
    typeof row.annualMembershipEnforced === "boolean" ? row.annualMembershipEnforced : fallback.annualMembershipEnforced;
  const annualMembershipVisibleRaw =
    typeof row.annualMembershipVisible === "boolean" ? row.annualMembershipVisible : fallback.annualMembershipVisible;
  // 운영 정책 강제: OFF/ON(visible/enforced) 조합은 허용하지 않는다.
  const annualMembershipVisible = annualMembershipEnforced ? true : annualMembershipVisibleRaw;
  return {
    annualMembershipVisible,
    annualMembershipEnforced,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : fallback.updatedAt,
  };
}

const EMPTY_STORE: DevStore = {
  users: [],
  legacyUserIdAliases: {},
  clientApplications: [],
  tournaments: [],
  tournamentApplications: [],
  bracketParticipantSnapshots: [],
  brackets: [],
  settlements: [],
  notifications: [],
  proofImages: [],
  outlinePdfAssets: [],
  auditLogs: [],
  siteLayoutConfig: createDefaultSiteLayoutConfig(),
  siteNotice: createDefaultSiteNotice(),
  siteCommunityConfig: createDefaultSiteCommunityConfig(),
  platformOperationSettings: createDefaultPlatformOperationSettings(),
  publishedCardSnapshots: [],
  tournamentPublishedCards: [],
  sitePageBuilderDrafts: [],
  sitePageBuilderPublishedPages: [],
  webPushSubscriptions: [],
  fcmDeviceTokens: [],
  clientOrganizations: [],
  clientVenueIntros: [],
  communityPosts: [],
  communityComments: [],
  clientInquiries: [],
  inquiryComments: [],
};

function normalizeCommunityCommentRow(row: unknown): CommunityComment | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const postId = typeof r.postId === "string" ? r.postId.trim() : "";
  const authorUserId = typeof r.authorUserId === "string" ? r.authorUserId.trim() : "";
  const authorNickname = typeof r.authorNickname === "string" ? r.authorNickname.trim() : "";
  const content = typeof r.content === "string" ? r.content : "";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  if (!id || !postId || !authorUserId || !authorNickname || !createdAt) return null;
  return {
    id,
    postId,
    authorUserId,
    authorNickname,
    content,
    createdAt,
    isDeleted: r.isDeleted === true,
  };
}

function normalizeClientInquiryRow(row: unknown): ClientInquiryStored | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const clientUserId = typeof r.clientUserId === "string" ? r.clientUserId.trim() : "";
  const clientOrganizationIdRaw = r.clientOrganizationId;
  const clientOrganizationId =
    clientOrganizationIdRaw === null || clientOrganizationIdRaw === undefined
      ? null
      : typeof clientOrganizationIdRaw === "string" && clientOrganizationIdRaw.trim()
        ? clientOrganizationIdRaw.trim()
        : null;
  const typeRaw = r.type;
  const type: ClientInquiryType =
    typeRaw === "FEATURE" ? "FEATURE" : typeRaw === "ERROR" ? "ERROR" : "ERROR";
  const title = typeof r.title === "string" ? r.title : "";
  const body = typeof r.body === "string" ? r.body : "";
  const imageUrls = normalizeInquiryImageUrls(r.imageUrls);
  const statusRaw = r.status;
  const status: ClientInquiryStatus =
    statusRaw === "DONE" ? "DONE" : statusRaw === "CHECKED" ? "CHECKED" : "OPEN";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : createdAt;
  if (!id || !clientUserId || !createdAt) return null;
  return {
    id,
    clientUserId,
    clientOrganizationId,
    type,
    title: title.trim() || "(제목 없음)",
    body,
    imageUrls,
    status,
    createdAt,
    updatedAt,
  };
}

function normalizeInquiryImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const u = item.trim();
    if (!u) continue;
    out.push(u);
    if (out.length >= MAX_CLIENT_INQUIRY_IMAGES) break;
  }
  return out;
}

function normalizeInquiryCommentImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const u = item.trim();
    if (!u) continue;
    out.push(u);
    if (out.length >= MAX_CLIENT_INQUIRY_COMMENT_IMAGES) break;
  }
  return out;
}

function normalizeClientInquiryCommentRow(row: unknown): ClientInquiryCommentStored | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const inquiryId = typeof r.inquiryId === "string" ? r.inquiryId.trim() : "";
  const authorUserId = typeof r.authorUserId === "string" ? r.authorUserId.trim() : "";
  const roleRaw = r.authorRole;
  const authorRole: ClientInquiryCommentAuthorRole =
    roleRaw === "PLATFORM" ? "PLATFORM" : "CLIENT";
  const body = typeof r.body === "string" ? r.body : "";
  const imageUrls = normalizeInquiryCommentImageUrls(r.imageUrls);
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  if (!id || !inquiryId || !authorUserId || !createdAt) return null;
  return {
    id,
    inquiryId,
    authorRole,
    authorUserId,
    body,
    imageUrls,
    createdAt,
  };
}

const SITE_COMMUNITY_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1", "extra2"];

function isSiteCommunityBoardKey(value: unknown): value is SiteCommunityBoardKey {
  return typeof value === "string" && SITE_COMMUNITY_BOARD_KEYS.includes(value as SiteCommunityBoardKey);
}

export function normalizeCommunityPostImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const u = item.trim();
    if (!u) continue;
    out.push(u);
    if (out.length >= MAX_COMMUNITY_POST_IMAGE_COUNT) break;
  }
  return out;
}

function normalizeCommunityBoardPostRow(row: unknown): CommunityBoardPost | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const boardTypeRaw = r.boardType;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const content = typeof r.content === "string" ? r.content : "";
  const authorUserId = typeof r.authorUserId === "string" ? r.authorUserId.trim() : "";
  const authorNickname = typeof r.authorNickname === "string" ? r.authorNickname.trim() : "";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : createdAt || new Date().toISOString();
  if (!id || !isSiteCommunityBoardKey(boardTypeRaw) || !title || !authorUserId || !authorNickname || !createdAt) {
    return null;
  }
  const viewCount = Number.isFinite(Number(r.viewCount)) ? Math.max(0, Math.floor(Number(r.viewCount))) : 0;
  const commentCount = Number.isFinite(Number(r.commentCount)) ? Math.max(0, Math.floor(Number(r.commentCount))) : 0;
  const isDeleted = r.isDeleted === true;
  const imageUrls = normalizeCommunityPostImageUrls(r.imageUrls);
  const imageSizeLevels = normalizeCommunityPostImageSizeLevels(imageUrls.length, r.imageSizeLevels);
  return {
    id,
    boardType: boardTypeRaw,
    title,
    content,
    imageUrls,
    imageSizeLevels,
    authorUserId,
    authorNickname,
    createdAt,
    updatedAt,
    viewCount,
    commentCount,
    isDeleted,
  };
}

function ensureCommunityPostsSeed(store: DevStore): boolean {
  if (!Array.isArray(store.communityPosts)) {
    store.communityPosts = [];
  }
  if (store.communityPosts.length > 0) return false;
  const author = store.users.find((u) => u.role === "PLATFORM") ?? store.users[0];
  if (!author) return false;
  const uid = author.id;
  const nick = author.nickname;
  const now = new Date().toISOString();
  const seeds: CommunityBoardPost[] = [
    {
      id: "cm-f1",
      boardType: "free",
      title:
        "초보자도 참여 가능한 대회 추천합니다 긴 제목 말줄임 테스트용으로 한 줄을 넘기는 경우를 확인합니다",
      content: "동호회 규모에 맞는 대회를 찾을 때 확인하면 좋은 기준을 정리했습니다.\n\n안전한 참가를 위해 공지 사항을 꼭 읽어 주세요.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-04-01T09:15:00.000Z",
      updatedAt: now,
      viewCount: 128,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-f2",
      boardType: "free",
      title: "연습할 때 집중하는 방법 공유",
      content: "짧은 세션으로도 효과를 내려면 호흡과 루틴을 고정하는 것이 도움이 됩니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-28T18:40:00.000Z",
      updatedAt: now,
      viewCount: 45,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-f3",
      boardType: "free",
      title: "주말 동호회 모집합니다",
      content: "지역 및 연락처는 댓글 기능 오픈 후 안내 예정입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-20T11:05:00.000Z",
      updatedAt: now,
      viewCount: 201,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-q1",
      boardType: "qna",
      title: "참가신청 취소는 어디서 하나요?",
      content: "마이페이지의 신청 내역에서 가능한 경우가 많습니다. 대회마다 규정이 다를 수 있습니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-04-03T14:22:00.000Z",
      updatedAt: now,
      viewCount: 89,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-q2",
      boardType: "qna",
      title: "대회 참가비 환불 기준 문의",
      content: "개최 전 취소와 당일 취소에 따라 다를 수 있으니 요강의 환불 조항을 확인해 주세요.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-29T10:00:00.000Z",
      updatedAt: now,
      viewCount: 34,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-q3",
      boardType: "qna",
      title: "마이페이지 알림이 안 보일 때",
      content: "브라우저 알림 권한과 푸시 수신 동의를 함께 확인해 주세요.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-21T08:30:00.000Z",
      updatedAt: now,
      viewCount: 56,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-r1",
      boardType: "reviews",
      title: "봄 정기전 참가 후기",
      content: "진행이 매끄러웠고 안내가 친절했습니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-04-02T16:45:00.000Z",
      updatedAt: now,
      viewCount: 312,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-r2",
      boardType: "reviews",
      title: "현장 진행이 깔끔했던 대회 후기",
      content: "대진표 확인과 경기 호출이 명확했습니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-27T12:10:00.000Z",
      updatedAt: now,
      viewCount: 167,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-r3",
      boardType: "reviews",
      title: "첫 참가 경험 공유",
      content: "긴장했지만 스태프 안내 덕분에 무사히 참가했습니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-19T09:20:00.000Z",
      updatedAt: now,
      viewCount: 94,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e1-1",
      boardType: "extra1",
      title: "예비게시판 1 샘플 글 1",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-04-01T13:00:00.000Z",
      updatedAt: now,
      viewCount: 8,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e1-2",
      boardType: "extra1",
      title: "예비게시판 1 샘플 글 2",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-25T07:55:00.000Z",
      updatedAt: now,
      viewCount: 3,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e1-3",
      boardType: "extra1",
      title: "예비게시판 1 샘플 글 3",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-18T20:15:00.000Z",
      updatedAt: now,
      viewCount: 1,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e2-1",
      boardType: "extra2",
      title: "예비게시판 2 샘플 글 1",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-04-01T13:00:00.000Z",
      updatedAt: now,
      viewCount: 5,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e2-2",
      boardType: "extra2",
      title: "예비게시판 2 샘플 글 2",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-25T07:55:00.000Z",
      updatedAt: now,
      viewCount: 2,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
    {
      id: "cm-e2-3",
      boardType: "extra2",
      title: "예비게시판 2 샘플 글 3",
      content: "예비 게시판 샘플 본문입니다.",
      authorUserId: uid,
      authorNickname: nick,
      createdAt: "2026-03-18T20:15:00.000Z",
      updatedAt: now,
      viewCount: 1,
      commentCount: 0,
      imageUrls: [],
      imageSizeLevels: [],
      isDeleted: false,
    },
  ];
  store.communityPosts = seeds;
  return true;
}

function ensureDefaultPlatformAdminInStore(store: DevStore): boolean {
  if (store.users.length > 0) return false;
  const now = new Date().toISOString();
  store.users.push({
    id: stableUserIdFromDevIdentity({ email: DEFAULT_PLATFORM_ADMIN_EMAIL, phone: null }),
    loginId: DEFAULT_PLATFORM_ADMIN_LOGIN_ID,
    nickname: DEFAULT_PLATFORM_ADMIN_LOGIN_ID,
    name: DEFAULT_PLATFORM_ADMIN_NAME,
    email: DEFAULT_PLATFORM_ADMIN_EMAIL,
    phone: null,
    password: DEFAULT_PLATFORM_ADMIN_PASSWORD,
    role: "PLATFORM",
    createdAt: now,
    updatedAt: now,
    linkedVenueId: null,
    pushMarketingAgreed: true,
  });
  return true;
}

/** 임시 파일에 전체 문자열 기록 → 디스크 동기화 → rename으로 교체(본 파일에 이어쓰기 없음) */
async function atomicWriteJsonFile(targetPath: string, jsonString: string): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) {
    console.warn("[dev-store] skipped atomicWriteJsonFile (read-only in production):", targetPath);
    return;
  }
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmpPath = path.join(dir, `.${base}.tmp.${randomUUID()}`);
  try {
    const fh = await open(tmpPath, "w");
    try {
      await fh.writeFile(jsonString, "utf-8");
      await fh.sync();
    } finally {
      await fh.close();
    }
    try {
      await rename(tmpPath, targetPath);
    } catch (renameErr) {
      if (isRetriableFsError(renameErr)) {
        let renamed = false;
        for (const waitMs of STORE_IO_RENAME_RETRY_DELAYS_MS) {
          await sleep(waitMs);
          try {
            await rename(tmpPath, targetPath);
            renamed = true;
            break;
          } catch (retryErr) {
            if (!isRetriableFsError(retryErr)) throw retryErr;
          }
        }
        if (renamed) return;
        await copyFile(tmpPath, targetPath);
        await unlink(tmpPath);
        return;
      }
      throw renameErr;
    }
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }
}

/** 저장 직전: 파싱 가능한 메인 전체를 .backup + .last-good에 복사(직전 정상 스냅샷 보존) */
async function snapshotValidMainToBackupAndLastGoodBeforeWrite(): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) return;
  let content: string;
  try {
    content = await readFile(STORE_FILE_PATH, "utf-8");
  } catch {
    return;
  }
  if (!content.trim()) return;
  try {
    JSON.parse(content);
  } catch {
    return;
  }
  try {
    await copyFile(STORE_FILE_PATH, STORE_BACKUP_PATH);
    await writeFile(STORE_BACKUP_TIMESTAMP_PATH, `${new Date().toISOString()}\n`, "utf-8");
    await copyFile(STORE_FILE_PATH, STORE_LAST_GOOD_PATH);
  } catch (err) {
    console.error("[dev-store] pre-write backup/last-good mirror snapshot failed", err);
  }
}

async function loadPartialStoreFromJsonFile(filePath: string): Promise<Partial<DevStore> | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Partial<DevStore>;
  } catch {
    return null;
  }
}

async function loadDiskStorePartialsForMerge(): Promise<Partial<DevStore>[]> {
  const out: Partial<DevStore>[] = [];
  for (const p of [STORE_FILE_PATH, STORE_BACKUP_PATH, STORE_LAST_GOOD_PATH]) {
    const part = await loadPartialStoreFromJsonFile(p);
    if (part) out.push(part);
  }
  return out;
}

const CRITICAL_STORE_ARRAY_KEYS_FOR_READ_VALIDATION: (keyof DevStore)[] = [
  "tournaments",
  "publishedCardSnapshots",
  "tournamentApplications",
  "bracketParticipantSnapshots",
  "brackets",
];

/** JSON이 파싱되었지만 users·대회·스냅샷·대진 필드가 null/비배열이면 복구 경로로 넘긴다 */
function parsedCriticalStoreFieldsInvalid(parsed: Partial<DevStore>): boolean {
  if ("users" in parsed && (parsed.users === null || !Array.isArray(parsed.users))) {
    return true;
  }
  for (const key of CRITICAL_STORE_ARRAY_KEYS_FOR_READ_VALIDATION) {
    if (!(key in parsed)) continue;
    const v = parsed[key];
    if (v === null) return true;
    if (!Array.isArray(v)) return true;
  }
  return false;
}

/** 메인 → 백업 → last-good 순으로 읽어 첫 유효 스토어(형식 검사 통과) */
async function loadDevStoreFromFirstReadableDiskFile(): Promise<DevStore | null> {
  for (const p of [STORE_FILE_PATH, STORE_BACKUP_PATH, STORE_LAST_GOOD_PATH]) {
    try {
      const raw = await readFile(p, "utf-8");
      if (!raw.trim()) continue;
      const parsed = JSON.parse(raw) as Partial<DevStore>;
      if (parsedCriticalStoreFieldsInvalid(parsed)) continue;
      return buildDevStoreFromParsed(parsed);
    } catch {
      continue;
    }
  }
  return null;
}

/** 저장 시 일부 필드만 넘어와도 undefined인 키는 디스크 베이스라인 유지(전체 덮어쓰기 방지) */
function mergeShallowDefinedKeysFromIncoming(baseline: DevStore, incoming: DevStore): DevStore {
  const out: DevStore = { ...baseline };
  for (const key of Object.keys(incoming) as (keyof DevStore)[]) {
    const v = incoming[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key as string] = v as unknown;
    }
  }
  return out;
}

function mergeUsersField(incoming: DevUser[] | undefined, disk: Partial<DevStore>[]): DevUser[] {
  const inc = Array.isArray(incoming) ? incoming : [];
  if (inc.length > 0) return inc;
  for (const part of disk) {
    if (!Array.isArray(part.users)) continue;
    const users = part.users
      .map((u) => normalizeDevUserRecord(u))
      .filter((item): item is DevUser => item !== null);
    if (users.length > 0) {
      console.warn("[dev-store] 저장 데이터에 users가 비어 있어 기존 파일에서 users를 유지했습니다.");
      return users;
    }
  }
  return inc;
}

function mergeStoreArrayField<T>(
  incoming: T[] | undefined | null,
  disk: Partial<DevStore>[],
  key: keyof DevStore,
  label: string
): T[] {
  const inc = Array.isArray(incoming) ? incoming : [];
  if (inc.length > 0) return inc;
  for (const part of disk) {
    const v = part[key];
    if (Array.isArray(v) && (v as unknown[]).length > 0) {
      console.warn(`[dev-store] 저장 데이터에 ${label}가 비어 있어 기존 파일에서 유지했습니다.`);
      return v as T[];
    }
  }
  return inc;
}

/** users·대회·카드스냅샷·참가·대진 관련 배열이 비어 있으면 디스크 기존값으로 병합(빈 배열 덮어쓰기 방지) */
async function ensureCriticalStoreFieldsPreservedForWrite(store: DevStore): Promise<DevStore> {
  const disk = await loadDiskStorePartialsForMerge();
  const merged: DevStore = { ...store };
  merged.users = mergeUsersField(store.users, disk);
  merged.tournaments = mergeStoreArrayField(store.tournaments, disk, "tournaments", "tournaments");
  merged.publishedCardSnapshots = mergeStoreArrayField(
    store.publishedCardSnapshots,
    disk,
    "publishedCardSnapshots",
    "publishedCardSnapshots"
  );
  merged.tournamentPublishedCards = mergeStoreArrayField(
    store.tournamentPublishedCards,
    disk,
    "tournamentPublishedCards",
    "tournamentPublishedCards"
  );
  merged.tournamentApplications = mergeStoreArrayField(
    store.tournamentApplications,
    disk,
    "tournamentApplications",
    "tournamentApplications"
  );
  merged.bracketParticipantSnapshots = mergeStoreArrayField(
    store.bracketParticipantSnapshots,
    disk,
    "bracketParticipantSnapshots",
    "bracketParticipantSnapshots"
  );
  merged.brackets = mergeStoreArrayField(store.brackets, disk, "brackets", "brackets");
  return merged;
}

function createDefaultTournamentRule(): TournamentRuleSnapshot {
  return {
    entryCondition: null,
    entryQualificationType: "NONE",
    verificationMode: "NONE",
    verificationReviewRequired: true,
    verificationGuideText: null,
    eligibilityType: "NONE",
    eligibilityValue: null,
    eligibilityCompare: "LTE",
    divisionEnabled: false,
    divisionMetricType: "AVERAGE",
    divisionRulesJson: null,
    scope: "REGIONAL",
    region: null,
    nationalTournament: false,
    accountNumber: null,
    allowMultipleSlots: false,
    participantsListPublic: true,
    durationType: "1_DAY",
    durationDays: null,
    isScotch: false,
    teamScoreLimit: null,
    teamScoreRule: "LTE",
  };
}

function migrateLegacyDurationFields(raw: Partial<TournamentRuleSnapshot> & Record<string, unknown>): {
  durationType: TournamentDurationType;
  durationDays: number | null;
} {
  const durRaw = raw.durationType;
  const dur = typeof durRaw === "string" ? durRaw : "";
  const legacy = dur as "1_DAY" | "MULTI_DAY" | "2_DAYS" | "3_PLUS";
  const ddRaw = raw.durationDays;
  const ddNum = typeof ddRaw === "number" && Number.isFinite(ddRaw) ? Math.floor(ddRaw) : null;

  if (legacy === "1_DAY") {
    return { durationType: "1_DAY", durationDays: null };
  }
  if (legacy === "2_DAYS") {
    return { durationType: "MULTI_DAY", durationDays: 2 };
  }
  if (legacy === "3_PLUS") {
    const n = ddNum != null && ddNum >= 2 && ddNum <= 10 ? ddNum : 3;
    return { durationType: "MULTI_DAY", durationDays: n };
  }
  if (legacy === "MULTI_DAY") {
    const n = ddNum != null && ddNum >= 2 && ddNum <= 10 ? ddNum : 3;
    return { durationType: "MULTI_DAY", durationDays: n };
  }
  return { durationType: "1_DAY", durationDays: null };
}

function inferNationalTournamentFromScopeAndRegion(
  scope: TournamentScope,
  region: string | null | undefined
): boolean {
  if (scope === "NATIONAL") return true;
  const t = typeof region === "string" ? region.trim() : "";
  if (!t) return false;
  return t === "전국" || t.includes("전국");
}

function parseDivisionRulesJson(raw: unknown): TournamentDivisionRuleRow[] | null {
  if (raw == null) return null;
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const out: TournamentDivisionRuleRow[] = [];
  for (const it of arr) {
    if (it == null || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const minRaw = row.min;
    const maxRaw = row.max;
    const min = minRaw == null || minRaw === "" ? null : Number(minRaw);
    const max = maxRaw == null || maxRaw === "" ? null : Number(maxRaw);
    if (!name) continue;
    if (min != null && !Number.isFinite(min)) continue;
    if (max != null && !Number.isFinite(max)) continue;
    if (min != null && max != null && min >= max) continue;
    out.push({ name, min, max });
  }
  return out.length ? out : null;
}

function normalizeTournamentRule(partial: Partial<TournamentRuleSnapshot> | undefined | null): TournamentRuleSnapshot {
  const base = createDefaultTournamentRule();
  if (partial == null || typeof partial !== "object") return base;

  const rawPartial = partial as Partial<TournamentRuleSnapshot> & Record<string, unknown>;

  const eq = partial.entryQualificationType;
  const entryQualificationType: TournamentEntryQualificationType =
    eq === "SCORE" || eq === "EVER" || eq === "BOTH" || eq === "NONE" ? eq : base.entryQualificationType;

  const vm = partial.verificationMode;
  const verificationMode: TournamentVerificationMode =
    vm === "NONE" || vm === "AUTO" || vm === "MANUAL" ? vm : base.verificationMode;

  const dmt = partial.divisionMetricType;
  const divisionMetricType: TournamentDivisionMetricType =
    dmt === "AVERAGE" || dmt === "SCORE" ? dmt : base.divisionMetricType;

  const sc = partial.scope;
  const scope: TournamentScope = sc === "NATIONAL" || sc === "REGIONAL" ? sc : base.scope;

  const { durationType, durationDays } = migrateLegacyDurationFields(rawPartial);

  const tsr = partial.teamScoreRule;
  const teamScoreRule: TournamentTeamScoreRule = tsr === "LT" || tsr === "LTE" ? tsr : base.teamScoreRule;

  const ecr = partial.eligibilityCompare;
  const eligibilityCompare: TournamentTeamScoreRule = ecr === "LT" || ecr === "LTE" ? ecr : base.eligibilityCompare;

  const divisionRulesJson = parseDivisionRulesJson(partial.divisionRulesJson) ?? base.divisionRulesJson;

  const region =
    partial.region != null && String(partial.region).trim() !== ""
      ? String(partial.region).trim()
      : null;

  let eligibilityValue: number | null = null;
  const rawEv = partial.eligibilityValue;
  if (rawEv != null) {
    const n = Number(rawEv);
    if (Number.isFinite(n)) eligibilityValue = n;
  }

  let eligibilityType: TournamentEligibilityType = "NONE";
  if (
    entryQualificationType === "SCORE" ||
    entryQualificationType === "EVER" ||
    entryQualificationType === "BOTH"
  ) {
    eligibilityType = eligibilityValue != null && Number.isFinite(eligibilityValue) ? "UNDER" : "NONE";
  }

  const rule: TournamentRuleSnapshot = {
    ...base,
    entryCondition:
      typeof partial.entryCondition === "string" && partial.entryCondition.trim() !== ""
        ? partial.entryCondition.trim()
        : null,
    entryQualificationType,
    verificationMode,
    verificationReviewRequired: partial.verificationReviewRequired === false ? false : true,
    verificationGuideText:
      typeof partial.verificationGuideText === "string" && partial.verificationGuideText.trim() !== ""
        ? partial.verificationGuideText.trim()
        : null,
    eligibilityType,
    eligibilityValue,
    eligibilityCompare,
    divisionEnabled: partial.divisionEnabled === true,
    divisionMetricType,
    divisionRulesJson,
    scope,
    region,
    nationalTournament:
      typeof partial.nationalTournament === "boolean"
        ? partial.nationalTournament
        : inferNationalTournamentFromScopeAndRegion(scope, region),
    accountNumber:
      typeof partial.accountNumber === "string" && partial.accountNumber.trim() !== ""
        ? partial.accountNumber.trim()
        : null,
    allowMultipleSlots: partial.allowMultipleSlots === true,
    participantsListPublic: partial.participantsListPublic === false ? false : true,
    durationType,
    durationDays: durationType === "MULTI_DAY" ? durationDays : null,
    isScotch: partial.isScotch === true,
    teamScoreLimit: (() => {
      const raw: unknown = partial.teamScoreLimit;
      if (raw == null) return null;
      if (typeof raw === "string" && raw.trim() === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.floor(n) : null;
    })(),
    teamScoreRule,
  };

  if (!Number.isFinite(rule.teamScoreLimit ?? NaN)) {
    rule.teamScoreLimit = null;
  }

  if (!rule.isScotch) {
    rule.teamScoreLimit = null;
    rule.teamScoreRule = "LTE";
  }

  rule.nationalTournament = inferNationalTournamentFromScopeAndRegion(rule.scope, rule.region);

  if (!rule.divisionEnabled) {
    rule.divisionRulesJson = null;
  }

  if (rule.verificationMode !== "AUTO") {
    rule.divisionEnabled = false;
    rule.divisionRulesJson = null;
  }

  const eqType = rule.entryQualificationType;
  if (eqType === "NONE") {
    rule.entryCondition = null;
    rule.eligibilityType = "NONE";
    rule.eligibilityValue = null;
  }

  if (rule.eligibilityType !== "UNDER") {
    rule.eligibilityValue = null;
  }

  if (rule.durationType === "1_DAY") {
    rule.durationDays = null;
  } else {
    const n = rule.durationDays ?? 0;
    if (n < 2 || n > 10) {
      rule.durationType = "MULTI_DAY";
      rule.durationDays = 3;
    }
  }

  return rule;
}

function parseTournamentEventDates(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out.push(s);
  }
  return out.length ? out.sort() : null;
}

function parseTournamentExtraVenues(raw: unknown): TournamentExtraVenueRow[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: TournamentExtraVenueRow[] = [];
  for (const it of raw) {
    if (it == null || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const address = typeof row.address === "string" ? row.address.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const phone = typeof row.phone === "string" ? row.phone.trim() : "";
    if (!address && !name && !phone) continue;
    out.push({ address, name, phone });
  }
  return out.length ? out : null;
}

/** 카탈로그 venue id 또는 게시된 등록 당구장(org slug/id) */
function resolveVenueGuideVenueIdFromOrgs(
  orgs: ClientOrganizationStored[],
  raw: unknown
): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  if (isValidSiteVenueId(t)) return t;
  const org = orgs.find(
    (x) =>
      x.type === "VENUE" &&
      x.approvalStatus === "APPROVED" &&
      x.status === "ACTIVE" &&
      x.isPublished &&
      x.setupCompleted &&
      (x.slug === t || x.id === t)
  );
  return org ? (org.slug?.trim() || org.id) : null;
}

function resolveVenueGuideVenueIdFromStore(store: DevStore, raw: unknown): string | null {
  return resolveVenueGuideVenueIdFromOrgs(store.clientOrganizations, raw);
}

function buildTournamentFromParsedRow(raw: unknown, clientOrganizations: ClientOrganizationStored[]): Tournament {
  const t = raw as Record<string, unknown>;
  const id = typeof t.id === "string" ? t.id : "";
  const title = typeof t.title === "string" ? t.title : "";
  const date = typeof t.date === "string" ? t.date : "";
  const location = typeof t.location === "string" ? t.location : "";
  const maxParticipants = Number.isFinite(Number(t.maxParticipants)) ? Math.max(1, Math.floor(Number(t.maxParticipants))) : 24;
  const entryFee = Number.isFinite(Number(t.entryFee)) ? Math.max(0, Math.floor(Number(t.entryFee))) : 0;
  const createdBy = typeof t.createdBy === "string" ? t.createdBy : "";
  const createdAt = typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString();
  const ruleRaw = t.rule;
  const rule =
    ruleRaw != null && typeof ruleRaw === "object"
      ? normalizeTournamentRule(ruleRaw as Partial<TournamentRuleSnapshot>)
      : createDefaultTournamentRule();

  const posterRaw = t.posterImageUrl;
  const posterImageUrl =
    typeof posterRaw === "string" && posterRaw.trim() !== "" ? posterRaw.trim() : null;
  const summaryRaw = t.summary;
  const summary = typeof summaryRaw === "string" && summaryRaw.trim() !== "" ? summaryRaw.trim() : null;
  const prizeRaw = t.prizeInfo;
  const prizeInfo = typeof prizeRaw === "string" && prizeRaw.trim() !== "" ? prizeRaw.trim() : null;

  const modeRaw = t.outlineDisplayMode;
  const outlineDisplayMode: OutlineDisplayMode | null =
    modeRaw === "TEXT" || modeRaw === "IMAGE" || modeRaw === "PDF" ? modeRaw : null;
  const outlineHtmlRaw = t.outlineHtml;
  const outlineHtml = typeof outlineHtmlRaw === "string" && outlineHtmlRaw !== "" ? outlineHtmlRaw : null;
  const outlineImgRaw = t.outlineImageUrl;
  const outlineImageUrl =
    typeof outlineImgRaw === "string" && outlineImgRaw.trim() !== "" ? outlineImgRaw.trim() : null;
  const outlinePdfRaw = t.outlinePdfUrl;
  const outlinePdfUrl =
    typeof outlinePdfRaw === "string" && outlinePdfRaw.trim() !== "" ? outlinePdfRaw.trim() : null;

  const vgRaw = t.venueGuideVenueId;
  const venueGuideVenueId = resolveVenueGuideVenueIdFromOrgs(clientOrganizations, vgRaw);

  const statusBadge = normalizeTournamentStatusBadge(t.statusBadge);

  const eventDates = parseTournamentEventDates(t.eventDates);
  const extraVenues = parseTournamentExtraVenues(t.extraVenues);

  return {
    id,
    title,
    date,
    eventDates,
    location,
    extraVenues,
    maxParticipants,
    entryFee,
    createdBy,
    createdAt,
    posterImageUrl,
    statusBadge,
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule,
  };
}

function normalizeWebPushSubscriptionRow(row: unknown): WebPushSubscriptionRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const userId = typeof r.userId === "string" ? r.userId.trim() : "";
  const endpoint = typeof r.endpoint === "string" ? r.endpoint.trim() : "";
  const keysRaw = r.keys;
  if (!keysRaw || typeof keysRaw !== "object") return null;
  const kr = keysRaw as Record<string, unknown>;
  const p256dh = typeof kr.p256dh === "string" ? kr.p256dh.trim() : "";
  const auth = typeof kr.auth === "string" ? kr.auth.trim() : "";
  if (!id || !userId || !endpoint || !p256dh || !auth) return null;
  const expRaw = r.expirationTime;
  const expirationTime =
    expRaw === null || expRaw === undefined
      ? null
      : Number.isFinite(Number(expRaw))
        ? Number(expRaw)
        : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : createdAt;
  return {
    id,
    userId,
    endpoint,
    keys: { p256dh, auth },
    expirationTime,
    createdAt,
    updatedAt,
  };
}

function normalizeFcmDeviceTokenRow(row: unknown): FcmDeviceTokenRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const userId = typeof r.userId === "string" ? r.userId.trim() : "";
  const token = typeof r.token === "string" ? r.token.trim() : "";
  if (!id || !userId || !token) return null;
  const platformRaw = r.platform;
  const platform =
    platformRaw === null || platformRaw === undefined
      ? null
      : typeof platformRaw === "string" && platformRaw.trim()
        ? platformRaw.trim()
        : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : createdAt;
  return { id, userId, token, platform, createdAt, updatedAt };
}

function normalizeProofImageRow(row: unknown): ProofImageAsset | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const uploaderUserId = typeof r.uploaderUserId === "string" ? r.uploaderUserId.trim() : "";
  const extRaw = r.originalExt;
  const originalExt =
    extRaw === "jpg" || extRaw === "png" || extRaw === "webp" ? extRaw : ("jpg" as const);
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  if (!id || !uploaderUserId) return null;
  const sitePublic = r.sitePublic === true;
  return { id, uploaderUserId, originalExt, createdAt, ...(sitePublic ? { sitePublic: true } : {}) };
}

function normalizeClientApplicationRow(row: unknown): ClientApplication | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const userId = typeof r.userId === "string" ? r.userId.trim() : "";
  const organizationName = typeof r.organizationName === "string" ? r.organizationName.trim() : "";
  const contactName = typeof r.contactName === "string" ? r.contactName.trim() : "";
  const contactPhone = typeof r.contactPhone === "string" ? r.contactPhone.trim() : "";
  if (!id || !userId || !organizationName || !contactName || !contactPhone) return null;
  const statusRaw = r.status;
  const status: ClientApplicationStatus =
    statusRaw === "APPROVED" || statusRaw === "REJECTED" || statusRaw === "PENDING" ? statusRaw : "PENDING";
  const requestedRaw = r.requestedClientType;
  const requestedClientType: ClientRequestedType =
    requestedRaw === "REGISTERED" || requestedRaw === "GENERAL" ? requestedRaw : "GENERAL";
  const now = new Date().toISOString();
  const toOptional = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const t = value.trim();
    return t.length ? t : null;
  };
  return {
    id,
    userId,
    organizationName,
    contactName,
    contactPhone,
    requestedClientType,
    status,
    rejectedReason: toOptional(r.rejectedReason),
    reviewedAt: toOptional(r.reviewedAt),
    reviewedByUserId: toOptional(r.reviewedByUserId),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : now,
  };
}

function normalizeClientOrganizationStoredRow(row: unknown): ClientOrganizationStored | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const clientUserId = typeof r.clientUserId === "string" ? r.clientUserId.trim() : "";
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!clientUserId || !id) return null;
  const now = new Date().toISOString();
  const type = typeof r.type === "string" && r.type.trim() ? r.type.trim() : "VENUE";
  const s = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length ? t : null;
  };
  const ab = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const clientTypeRaw = r.clientType;
  const clientType: ClientOrganizationType =
    clientTypeRaw === "REGISTERED" || clientTypeRaw === "GENERAL" ? clientTypeRaw : "GENERAL";
  const approvalStatusRaw = r.approvalStatus;
  const approvalStatus: ClientOrganizationApprovalStatus =
    approvalStatusRaw === "PENDING" || approvalStatusRaw === "APPROVED" || approvalStatusRaw === "REJECTED"
      ? approvalStatusRaw
      : "APPROVED";
  const statusRaw = r.status;
  const status: ClientOrganizationStatus =
    statusRaw === "ACTIVE" || statusRaw === "SUSPENDED" || statusRaw === "EXPELLED" ? statusRaw : "ACTIVE";
  const membershipTypeRaw = r.membershipType;
  const membershipType: ClientMembershipType =
    membershipTypeRaw === "ANNUAL" || membershipTypeRaw === "NONE" ? membershipTypeRaw : "NONE";
  return {
    clientUserId,
    id,
    slug: typeof r.slug === "string" ? r.slug.trim() : "",
    name: typeof r.name === "string" ? r.name.trim() : "",
    type,
    shortDescription: s(r.shortDescription),
    description: s(r.description),
    fullDescription: s(r.fullDescription),
    logoImageUrl: s(r.logoImageUrl),
    coverImageUrl: s(r.coverImageUrl),
    phone: s(r.phone),
    email: s(r.email),
    website: s(r.website),
    address: s(r.address),
    addressDetail: s(r.addressDetail),
    addressJibun: s(r.addressJibun),
    zipCode: s(r.zipCode),
    latitude: (() => {
      if (typeof r.latitude === "number" && Number.isFinite(r.latitude)) return r.latitude;
      if (typeof r.latitude === "string" && r.latitude.trim() !== "") {
        const n = Number(r.latitude);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })(),
    longitude: (() => {
      if (typeof r.longitude === "number" && Number.isFinite(r.longitude)) return r.longitude;
      if (typeof r.longitude === "string" && r.longitude.trim() !== "") {
        const n = Number(r.longitude);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })(),
    addressNaverMapEnabled: ab(r.addressNaverMapEnabled) ?? false,
    region: s(r.region),
    typeSpecificJson: s(r.typeSpecificJson),
    clientType,
    approvalStatus,
    status,
    adminRemarks: s(r.adminRemarks),
    membershipType,
    membershipExpireAt: s(r.membershipExpireAt),
    isPublished: typeof r.isPublished === "boolean" ? r.isPublished : false,
    setupCompleted: typeof r.setupCompleted === "boolean" ? r.setupCompleted : false,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : now,
  };
}

/** 기존 수동 slug가 있으면 유지, 없으면 `{조직 id}_client` */
function resolveClientOrgSlug(existing: ClientOrganizationStored | null, orgId: string): string {
  const prev = existing?.slug?.trim() ?? "";
  if (prev) return prev;
  return `${orgId}_client`;
}

function normalizeClientVenueIntroStoredRow(row: unknown): ClientVenueIntroStored | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const clientUserId = typeof r.clientUserId === "string" ? r.clientUserId.trim() : "";
  if (!clientUserId) return null;
  const now = new Date().toISOString();
  const modeRaw = r.outlineDisplayMode;
  const outlineDisplayMode: OutlineDisplayMode | null =
    modeRaw === "TEXT" || modeRaw === "IMAGE" || modeRaw === "PDF" ? modeRaw : null;
  const outlineHtmlRaw = r.outlineHtml;
  const outlineHtml = typeof outlineHtmlRaw === "string" && outlineHtmlRaw !== "" ? outlineHtmlRaw : null;
  const outlineImgRaw = r.outlineImageUrl;
  const outlineImageUrl =
    typeof outlineImgRaw === "string" && outlineImgRaw.trim() !== "" ? outlineImgRaw.trim() : null;
  const outlinePdfRaw = r.outlinePdfUrl;
  const outlinePdfUrl =
    typeof outlinePdfRaw === "string" && outlinePdfRaw.trim() !== "" ? outlinePdfRaw.trim() : null;
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : now;
  return {
    clientUserId,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    updatedAt,
  };
}

function normalizeTournamentPublishedCardRow(row: unknown): TournamentPublishedCard | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const snapshotId = typeof r.snapshotId === "string" ? r.snapshotId.trim() : "";
  const tournamentId = typeof r.tournamentId === "string" ? r.tournamentId.trim() : "";
  if (!snapshotId || !tournamentId) return null;
  const templateType = r.templateType === "B" ? "B" : "A";
  const backgroundType = r.backgroundType === "theme" ? "theme" : "image";
  const themeType =
    r.themeType === "light" ? "light" : r.themeType === "natural" ? "natural" : "dark";
  const title = typeof r.title === "string" ? r.title : "";
  const t1 = r.textLine1;
  const t2 = r.textLine2;
  const textLine1 = typeof t1 === "string" && t1.trim() ? t1.trim() : null;
  const textLine2 = typeof t2 === "string" && t2.trim() ? t2.trim() : null;
  const image320Url = typeof r.image320Url === "string" ? r.image320Url : "";
  const imageId = typeof r.imageId === "string" ? r.imageId : "";
  const status = typeof r.status === "string" ? r.status : "";
  const targetDetailUrl = typeof r.targetDetailUrl === "string" ? r.targetDetailUrl : "";
  const publishedAt = typeof r.publishedAt === "string" ? r.publishedAt : new Date().toISOString();
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : publishedAt;
  const publishedBy = typeof r.publishedBy === "string" ? r.publishedBy : "";
  const version = typeof r.version === "number" ? r.version : 1;
  const isPublished = typeof r.isPublished === "boolean" ? r.isPublished : true;
  const isActive = typeof r.isActive === "boolean" ? r.isActive : false;
  const deadlineSortValue = typeof r.deadlineSortValue === "string" ? r.deadlineSortValue : undefined;
  const showOnMainSlide =
    typeof r.showOnMainSlide === "boolean" ? r.showOnMainSlide : tournamentStatusEligibleForMainSlide(status);
  const base: TournamentPublishedCard = {
    snapshotId,
    tournamentId,
    title,
    textLine1,
    textLine2,
    templateType,
    backgroundType,
    themeType,
    image320Url,
    imageId,
    status,
    targetDetailUrl,
    publishedAt,
    updatedAt,
    isPublished,
    isActive,
    version,
    publishedBy,
    showOnMainSlide,
    deadlineSortValue,
  };
  if ("mediaBackground" in r) {
    base.mediaBackground = typeof r.mediaBackground === "string" ? r.mediaBackground : null;
  }
  if ("imageOverlayBlend" in r) {
    base.imageOverlayBlend = typeof r.imageOverlayBlend === "boolean" ? r.imageOverlayBlend : null;
  }
  if ("imageOverlayOpacity" in r) {
    const x = r.imageOverlayOpacity;
    base.imageOverlayOpacity =
      typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0.15, x)) : null;
  }
  if ("cardDisplayDate" in r) {
    base.cardDisplayDate = typeof r.cardDisplayDate === "string" ? r.cardDisplayDate : null;
  }
  if ("cardDisplayLocation" in r) {
    base.cardDisplayLocation = typeof r.cardDisplayLocation === "string" ? r.cardDisplayLocation : null;
  }
  return base;
}

function buildDevStoreFromParsed(parsed: Partial<DevStore>): DevStore {
  const clientOrganizations: ClientOrganizationStored[] = Array.isArray(parsed.clientOrganizations)
    ? (parsed.clientOrganizations as unknown[])
        .map((row) => normalizeClientOrganizationStoredRow(row))
        .filter((item): item is ClientOrganizationStored => item !== null)
    : [];
  return {
    users: Array.isArray(parsed.users) ? parsed.users.map(normalizeDevUserRecord).filter((item): item is DevUser => item !== null) : [],
    legacyUserIdAliases: normalizeLegacyUserIdAliases(parsed.legacyUserIdAliases),
    clientApplications: Array.isArray(parsed.clientApplications)
      ? (parsed.clientApplications as unknown[])
          .map((row) => normalizeClientApplicationRow(row))
          .filter((item): item is ClientApplication => item !== null)
      : [],
    tournaments: Array.isArray(parsed.tournaments)
      ? parsed.tournaments.map((row) => buildTournamentFromParsedRow(row, clientOrganizations))
      : [],
    tournamentApplications: Array.isArray(parsed.tournamentApplications) ? parsed.tournamentApplications : [],
    bracketParticipantSnapshots: Array.isArray(parsed.bracketParticipantSnapshots)
      ? parsed.bracketParticipantSnapshots
      : [],
    brackets: Array.isArray(parsed.brackets) ? parsed.brackets : [],
    settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    proofImages: Array.isArray(parsed.proofImages)
      ? (parsed.proofImages as unknown[])
          .map((row) => normalizeProofImageRow(row))
          .filter((item): item is ProofImageAsset => item !== null)
      : [],
    outlinePdfAssets: Array.isArray(parsed.outlinePdfAssets)
      ? (parsed.outlinePdfAssets as unknown[])
          .map((row) => {
            const r = row as Record<string, unknown>;
            const id = typeof r.id === "string" ? r.id.trim() : "";
            const uploaderUserId = typeof r.uploaderUserId === "string" ? r.uploaderUserId.trim() : "";
            const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
            if (!id || !uploaderUserId) return null;
            const fk = r.fileKind;
            const fileKind = fk === "docx" ? ("docx" as const) : fk === "pdf" ? ("pdf" as const) : undefined;
            return { id, uploaderUserId, createdAt, ...(fileKind ? { fileKind } : {}) } satisfies OutlinePdfAsset;
          })
          .filter((item): item is OutlinePdfAsset => item !== null)
      : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    siteLayoutConfig: normalizeSiteLayoutConfig(parsed.siteLayoutConfig),
    siteNotice: normalizeSiteNotice(parsed.siteNotice),
    siteCommunityConfig: normalizeSiteCommunityConfig(parsed.siteCommunityConfig),
    platformOperationSettings: normalizePlatformOperationSettings(parsed.platformOperationSettings),
    publishedCardSnapshots: Array.isArray(parsed.publishedCardSnapshots)
      ? (parsed.publishedCardSnapshots as PublishedCardSnapshot[]).filter(
          (s) => (s as PublishedCardSnapshot & { snapshotSourceType?: string }).snapshotSourceType !== "TOURNAMENT_SNAPSHOT"
        )
      : [],
    tournamentPublishedCards: Array.isArray((parsed as Partial<DevStore>).tournamentPublishedCards)
      ? ((parsed as Partial<DevStore>).tournamentPublishedCards as unknown[]).map(normalizeTournamentPublishedCardRow).filter((x): x is TournamentPublishedCard => x !== null)
      : [],
    sitePageBuilderDrafts: Array.isArray(parsed.sitePageBuilderDrafts) ? parsed.sitePageBuilderDrafts : [],
    sitePageBuilderPublishedPages: Array.isArray(parsed.sitePageBuilderPublishedPages)
      ? parsed.sitePageBuilderPublishedPages
      : [],
    webPushSubscriptions: Array.isArray(parsed.webPushSubscriptions)
      ? (parsed.webPushSubscriptions as unknown[])
          .map((item) => normalizeWebPushSubscriptionRow(item))
          .filter((item): item is WebPushSubscriptionRecord => item !== null)
      : [],
    fcmDeviceTokens: Array.isArray(parsed.fcmDeviceTokens)
      ? (parsed.fcmDeviceTokens as unknown[])
          .map((item) => normalizeFcmDeviceTokenRow(item))
          .filter((item): item is FcmDeviceTokenRecord => item !== null)
      : [],
    clientOrganizations,
    clientVenueIntros: Array.isArray(parsed.clientVenueIntros)
      ? (parsed.clientVenueIntros as unknown[])
          .map((row) => normalizeClientVenueIntroStoredRow(row))
          .filter((item): item is ClientVenueIntroStored => item !== null)
      : [],
    communityPosts: Array.isArray((parsed as Partial<DevStore>).communityPosts)
      ? ((parsed as Partial<DevStore>).communityPosts as unknown[])
          .map((row) => normalizeCommunityBoardPostRow(row))
          .filter((item): item is CommunityBoardPost => item !== null)
      : [],
    communityComments: Array.isArray((parsed as Partial<DevStore>).communityComments)
      ? ((parsed as Partial<DevStore>).communityComments as unknown[])
          .map((row) => normalizeCommunityCommentRow(row))
          .filter((item): item is CommunityComment => item !== null)
      : [],
    clientInquiries: Array.isArray((parsed as Partial<DevStore>).clientInquiries)
      ? ((parsed as Partial<DevStore>).clientInquiries as unknown[])
          .map((row) => normalizeClientInquiryRow(row))
          .filter((item): item is ClientInquiryStored => item !== null)
      : [],
    inquiryComments: Array.isArray((parsed as Partial<DevStore>).inquiryComments)
      ? ((parsed as Partial<DevStore>).inquiryComments as unknown[])
          .map((row) => normalizeClientInquiryCommentRow(row))
          .filter((item): item is ClientInquiryCommentStored => item !== null)
      : [],
  };
}

async function ensureLastGoodMirrorIfMissing(store: DevStore): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) return;
  try {
    await readFile(STORE_LAST_GOOD_PATH, "utf-8");
  } catch {
    try {
      await atomicWriteJsonFile(STORE_LAST_GOOD_PATH, JSON.stringify(store, null, 2));
    } catch (error) {
      console.error("[dev-store] failed to create initial last-good mirror", error);
    }
  }
}

async function tryRecoverFromLastGood(): Promise<DevStore | null> {
  try {
    const raw = await readFile(STORE_LAST_GOOD_PATH, "utf-8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<DevStore>;
    const store = buildDevStoreFromParsed(parsed);
    ensureDefaultPlatformAdminInStore(store);
    reconcileDevStoreLoginIds(store);
    reconcileDevStoreUserIds(store);
    ensureCommunityPostsSeed(store);
    return store;
  } catch {
    return null;
  }
}

async function tryRecoverFromBackup(): Promise<DevStore | null> {
  try {
    const raw = await readFile(STORE_BACKUP_PATH, "utf-8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<DevStore>;
    const store = buildDevStoreFromParsed(parsed);
    ensureDefaultPlatformAdminInStore(store);
    reconcileDevStoreLoginIds(store);
    reconcileDevStoreUserIds(store);
    ensureCommunityPostsSeed(store);
    console.warn("[dev-store] dev-store 복구됨 (.backup)");
    return store;
  } catch {
    return null;
  }
}

async function tryRecoverFromCorruptBackupsNewestFirst(): Promise<DevStore | null> {
  let names: string[];
  try {
    names = await readdir(STORE_DIR_PATH);
  } catch {
    return null;
  }
  const corrupt = names.filter((n) => n.startsWith("v3-dev-store.json.corrupt.") && n.endsWith(".json"));
  const withStat = await Promise.all(
    corrupt.map(async (name) => {
      const p = path.join(STORE_DIR_PATH, name);
      const s = await stat(p);
      return { path: p, mtime: s.mtimeMs, size: s.size };
    })
  );
  withStat.sort((a, b) => b.mtime - a.mtime);
  for (const { path: filePath, size } of withStat) {
    if (size === 0) continue;
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<DevStore>;
      const store = buildDevStoreFromParsed(parsed);
      ensureDefaultPlatformAdminInStore(store);
      reconcileDevStoreLoginIds(store);
      reconcileDevStoreUserIds(store);
      ensureCommunityPostsSeed(store);
      return store;
    } catch {
      continue;
    }
  }
  return null;
}

async function backupCorruptMainSnapshot(content: string): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) return;
  if (!content.length) return;
  try {
    await writeFile(`${STORE_FILE_PATH}.corrupt.${Date.now()}.json`, content, "utf-8");
  } catch {
    // 백업 실패는 무시 (원인 확정용 로그는 위 console.error에 남김)
  }
}

async function ensureStoreFile(): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) return;
  await mkdir(STORE_DIR_PATH, { recursive: true });
  try {
    await readFile(STORE_FILE_PATH, "utf-8");
  } catch {
    try {
      const bu = await readFile(STORE_BACKUP_PATH, "utf-8");
      JSON.parse(bu);
      await copyFile(STORE_BACKUP_PATH, STORE_FILE_PATH);
      console.warn("[dev-store] dev-store 복구됨 (메인 파일 없음 → .backup 복원)");
      return;
    } catch {
      // no backup or invalid
    }
    const empty = JSON.stringify(EMPTY_STORE, null, 2);
    await atomicWriteJsonFile(STORE_FILE_PATH, empty);
    try {
      await atomicWriteJsonFile(STORE_LAST_GOOD_PATH, empty);
    } catch (error) {
      console.error("[dev-store] failed to seed last-good for new store file", error);
    }
  }
}

async function writeJsonWithRetry(targetPath: string, json: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= STORE_IO_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await atomicWriteJsonFile(targetPath, json);
      return;
    } catch (err) {
      lastError = err;
      if (!isRetriableFsError(err) || attempt === STORE_IO_WRITE_RETRY_DELAYS_MS.length) {
        throw err;
      }
      await sleep(STORE_IO_WRITE_RETRY_DELAYS_MS[attempt]!);
    }
  }
  throw lastError;
}

async function readStoreImpl(): Promise<DevStore> {
  if (isDevStoreFilePersistenceEnabled()) {
    await ensureStoreFile();
  }

  let content = "";
  try {
    let parsed: Partial<DevStore> | null = null;
    for (let attempt = 0; attempt <= STORE_IO_READ_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        content = await readFile(STORE_FILE_PATH, "utf-8");
      } catch (readErr) {
        if (!isRetriableFsError(readErr) || attempt === STORE_IO_READ_RETRY_DELAYS_MS.length) {
          throw readErr;
        }
        await sleep(STORE_IO_READ_RETRY_DELAYS_MS[attempt]!);
        continue;
      }

      try {
        parsed = JSON.parse(content) as Partial<DevStore>;
        break;
      } catch (parseErr) {
        if (!isRetriableJsonParseError(parseErr, content) || attempt === STORE_IO_READ_RETRY_DELAYS_MS.length) {
          throw parseErr;
        }
        await sleep(STORE_IO_READ_RETRY_DELAYS_MS[attempt]!);
      }
    }
    if (!parsed) {
      throw new Error("[dev-store] failed to parse store JSON after retries");
    }
    if (parsedCriticalStoreFieldsInvalid(parsed)) {
      throw new Error("[dev-store] critical store fields invalid shape");
    }
    const store = buildDevStoreFromParsed(parsed);
    ensureDefaultPlatformAdminInStore(store);
    reconcileDevStoreLoginIds(store);
    reconcileDevStoreUserIds(store);
    ensureCommunityPostsSeed(store);
    if (isDevStoreFilePersistenceEnabled()) {
      try {
        await ensureLastGoodMirrorIfMissing(store);
      } catch (mirrorErr) {
        console.error("[dev-store] ensureLastGoodMirrorIfMissing failed after successful read", mirrorErr);
      }
    }
    return store;
  } catch (err) {
    console.error("[dev-store] v3-dev-store.json read/parse failed; attempting recovery", err);
    await backupCorruptMainSnapshot(content);
    const fromLastGood = await tryRecoverFromLastGood();
    if (fromLastGood) {
      console.warn("[dev-store] recovered store from last-good snapshot");
      return fromLastGood;
    }
    const fromBackup = await tryRecoverFromBackup();
    if (fromBackup) {
      return fromBackup;
    }
    const fromOldCorrupt = await tryRecoverFromCorruptBackupsNewestFirst();
    if (fromOldCorrupt) {
      console.warn("[dev-store] recovered store from a non-empty corrupt backup file");
      return fromOldCorrupt;
    }
    const fallbackStore: DevStore = {
      users: [],
      legacyUserIdAliases: {},
      clientApplications: [],
      tournaments: [],
      tournamentApplications: [],
      bracketParticipantSnapshots: [],
      brackets: [],
      settlements: [],
      notifications: [],
      proofImages: [],
      outlinePdfAssets: [],
      auditLogs: [],
      siteLayoutConfig: createDefaultSiteLayoutConfig(),
      siteNotice: createDefaultSiteNotice(),
      siteCommunityConfig: createDefaultSiteCommunityConfig(),
      platformOperationSettings: createDefaultPlatformOperationSettings(),
      publishedCardSnapshots: [],
      tournamentPublishedCards: [],
      sitePageBuilderDrafts: [],
      sitePageBuilderPublishedPages: [],
      webPushSubscriptions: [],
      fcmDeviceTokens: [],
      clientOrganizations: [],
      clientVenueIntros: [],
      communityPosts: [],
      communityComments: [],
      clientInquiries: [],
      inquiryComments: [],
    };
    ensureDefaultPlatformAdminInStore(fallbackStore);
    reconcileDevStoreLoginIds(fallbackStore);
    ensureCommunityPostsSeed(fallbackStore);
    if (!isDevStoreFilePersistenceEnabled()) {
      console.warn("[dev-store] using in-memory fallback store (production read-only; disk persist skipped)");
    }
    return fallbackStore;
  }
}

async function writeStoreImpl(store: DevStore): Promise<void> {
  if (!isDevStoreFilePersistenceEnabled()) {
    console.warn("[dev-store] skipped writeStoreImpl (read-only in production)");
    return;
  }
  await snapshotValidMainToBackupAndLastGoodBeforeWrite();
  const baseline = await loadDevStoreFromFirstReadableDiskFile();
  const combined = baseline ? mergeShallowDefinedKeysFromIncoming(baseline, store) : store;
  const merged = await ensureCriticalStoreFieldsPreservedForWrite(combined);
  const json = JSON.stringify(merged, null, 2);
  await writeJsonWithRetry(STORE_FILE_PATH, json);
  try {
    await writeJsonWithRetry(STORE_LAST_GOOD_PATH, json);
  } catch (error) {
    console.error("[dev-store] failed to update last-good snapshot", error);
  }
}

/** 마이페이지 알림: 생성일 기준 보관 일수. 초과분은 readStore 시 메모리에서만 제거한다(읽기 경로에서는 디스크에 반영하지 않음). */
const USER_NOTIFICATION_RETENTION_DAYS = 30;

function pruneExpiredNotifications(store: DevStore): number {
  const retentionMs = USER_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  const before = store.notifications.length;
  store.notifications = store.notifications.filter((n) => {
    const t = Date.parse(n.createdAt);
    if (Number.isNaN(t)) return false;
    return t >= cutoff;
  });
  return before - store.notifications.length;
}

async function readStore(): Promise<DevStore> {
  return runStoreIoExclusive(async () => {
    const store = await readStoreImpl();
    const removed = pruneExpiredNotifications(store);
    if (removed > 0 && !isDevStoreFilePersistenceEnabled()) {
      console.warn("[dev-store] pruned expired notifications in memory only (read-only in production)", removed);
    }
    return store;
  });
}

async function writeStore(store: DevStore): Promise<void> {
  return runStoreIoExclusive(() => writeStoreImpl(store));
}

function appendAuditLogSafe(
  store: DevStore,
  params: {
    actorUserId?: string;
    actionType: string;
    targetType: string;
    targetId: string;
    meta?: Record<string, unknown>;
  }
): void {
  try {
    store.auditLogs.push({
      id: randomUUID(),
      actorUserId: params.actorUserId?.trim() || "SYSTEM",
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId,
      meta: params.meta ?? {},
      createdAt: new Date().toISOString(),
    });
  } catch {
    // 감사로그는 보조 기능이므로 실패해도 핵심 흐름에 영향을 주지 않는다.
  }
}

function normalizeOptional(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value?: string): string | null {
  const raw = normalizeOptional(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** dev-store: 동일 이메일/전화 식별자 → 항상 동일한 userId (스토어 재생성·HMR 후에도 불변) */
function stableUserIdFromDevIdentity(params: { email: string | null; phone: string | null }): string {
  const email = params.email?.trim() ? params.email.trim().toLowerCase() : null;
  const phone = params.phone?.trim() ? params.phone.trim() : null;
  let key: string;
  if (email) {
    key = `email:${email}`;
  } else if (phone) {
    key = `phone:${phone}`;
  } else {
    return randomUUID();
  }
  const hash = createHash("sha256").update(`v3-dev-user:\n${key}`).digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function normalizeLegacyUserIdAliases(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
      out[k.trim()] = v.trim();
    }
  }
  return out;
}

function normalizeLoginId(value?: string): string | null {
  const normalized = normalizeOptional(value)?.toLowerCase() ?? null;
  return normalized && /^[a-z0-9._-]+$/.test(normalized) ? normalized : null;
}

const NICKNAME_MIN_LEN = 2;
const NICKNAME_MAX_LEN = 12;

/** 닉네임 중복 비교용(앞뒤 공백 제거, 영문 소문자) */
export function nicknameCompareKey(value: string): string {
  return value.trim().toLowerCase();
}

/** 신규 입력·변경 시 닉네임 형식 검사 */
export function parseNicknameInput(raw: string): { ok: true; nickname: string } | { ok: false; error: string } {
  const nickname = raw.trim();
  if (!nickname) return { ok: false, error: "닉네임을 입력해 주세요." };
  if (nickname.length < NICKNAME_MIN_LEN || nickname.length > NICKNAME_MAX_LEN) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MIN_LEN}~${NICKNAME_MAX_LEN}자로 입력해 주세요.` };
  }
  return { ok: true, nickname };
}

function isNicknameKeyTakenInStore(
  store: DevStore,
  key: string,
  excludeUserId?: string
): boolean {
  return store.users.some((u) => {
    if (excludeUserId && u.id === excludeUserId) return false;
    return nicknameCompareKey(u.nickname) === key;
  });
}

/** 형식 검사 후, excludeUserId 제외하고 중복 여부 확인 */
export async function checkNicknameAvailability(
  raw: string,
  excludeUserId?: string
): Promise<{ ok: true; nickname: string } | { ok: false; error: string }> {
  const parsed = parseNicknameInput(raw);
  if (!parsed.ok) return parsed;
  const key = nicknameCompareKey(parsed.nickname);
  if (useFirestoreUsersInProduction()) {
    try {
      if (await firestoreIsNicknameKeyTaken(key, excludeUserId)) {
        return { ok: false, error: "이미 사용중" };
      }
    } catch (e) {
      console.error("[dev-store] checkNicknameAvailability Firestore 실패", e);
      return { ok: false, error: "닉네임 확인 중 오류가 발생했습니다." };
    }
  }
  const store = await readStore();
  if (isNicknameKeyTakenInStore(store, key, excludeUserId)) {
    return { ok: false, error: "이미 사용중" };
  }
  return { ok: true, nickname: parsed.nickname };
}

function normalizeDevUserRecord(user: unknown): DevUser | null {
  if (!user || typeof user !== "object") return null;
  const row = user as Partial<DevUser> & { loginId?: unknown };
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const loginId =
    typeof row.loginId === "string" && row.loginId.trim()
      ? normalizeLoginId(row.loginId)
      : typeof row.email === "string" && row.email.trim()?.toLowerCase() === DEFAULT_PLATFORM_ADMIN_EMAIL
        ? normalizeLoginId(DEFAULT_PLATFORM_ADMIN_LOGIN_ID)
      : typeof row.email === "string" && row.email.trim()
        ? normalizeLoginId(row.email)
        : null;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !loginId || !name) return null;
  const rawNick = typeof (row as Partial<DevUser>).nickname === "string" ? (row as Partial<DevUser>).nickname!.trim() : "";
  let nickname: string;
  if (rawNick) {
    const nickParsed = parseNicknameInput(rawNick);
    nickname = nickParsed.ok ? nickParsed.nickname : loginId;
  } else {
    nickname = loginId;
  }
  const linkedRaw = row.linkedVenueId;
  const linkedVenueId =
    typeof linkedRaw === "string" && linkedRaw.trim() !== "" && isValidSiteVenueId(linkedRaw.trim())
      ? linkedRaw.trim()
      : null;
  const pushMarketingAgreed =
    typeof row.pushMarketingAgreed === "boolean" ? row.pushMarketingAgreed : true;
  const status: PlatformUserStatus =
    row.status === "SUSPENDED" || row.status === "DELETED" ? row.status : "ACTIVE";
  return {
    id,
    loginId,
    nickname,
    name,
    email: typeof row.email === "string" && row.email.trim() ? row.email.trim().toLowerCase() : null,
    phone: normalizePhone(typeof row.phone === "string" ? row.phone : ""),
    password: typeof row.password === "string" ? row.password : "",
    role: row.role === "CLIENT" || row.role === "PLATFORM" ? row.role : "USER",
    status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    linkedVenueId,
    pushMarketingAgreed,
  };
}

const MAX_USER_ID_ALIAS_HOPS = 24;

function resolveCanonicalUserId(store: DevStore, rawUserId: string): string {
  const aliases = store.legacyUserIdAliases ?? {};
  let id = rawUserId.trim();
  const seen = new Set<string>();
  for (let i = 0; i < MAX_USER_ID_ALIAS_HOPS; i += 1) {
    if (!id || seen.has(id)) break;
    seen.add(id);
    const next = aliases[id];
    if (!next || next === id) break;
    id = next;
  }
  return id;
}

function findUserByRawId(store: DevStore, rawUserId: string): DevUser | null {
  const id = resolveCanonicalUserId(store, rawUserId);
  return store.users.find((u) => u.id === id) ?? null;
}

function recordUserIdAlias(store: DevStore, fromId: string, toId: string): void {
  if (fromId === toId) return;
  if (!store.legacyUserIdAliases) store.legacyUserIdAliases = {};
  store.legacyUserIdAliases[fromId] = toId;
}

function remapUserIdInStore(store: DevStore, fromId: string, toId: string): void {
  if (fromId === toId) return;
  for (const app of store.clientApplications) {
    if (app.userId === fromId) app.userId = toId;
  }
  for (const t of store.tournaments) {
    if (t.createdBy === fromId) t.createdBy = toId;
  }
  for (const ta of store.tournamentApplications) {
    if (ta.userId === fromId) ta.userId = toId;
  }
  for (const snap of store.bracketParticipantSnapshots) {
    for (const p of snap.participants) {
      if (p.userId === fromId) p.userId = toId;
    }
  }
  for (const b of store.brackets) {
    for (const r of b.rounds) {
      for (const m of r.matches) {
        if (m.player1.userId === fromId) m.player1.userId = toId;
        if (m.player2.userId === fromId) m.player2.userId = toId;
        if (m.winnerUserId === fromId) m.winnerUserId = toId;
      }
    }
  }
  for (const n of store.notifications) {
    if (n.userId === fromId) n.userId = toId;
  }
  for (const img of store.proofImages) {
    if (img.uploaderUserId === fromId) img.uploaderUserId = toId;
  }
  for (const log of store.auditLogs) {
    if (log.actorUserId === fromId) log.actorUserId = toId;
  }
  for (const draft of store.sitePageBuilderDrafts) {
    if (draft.savedBy === fromId) draft.savedBy = toId;
  }
  for (const pub of store.sitePageBuilderPublishedPages) {
    if (pub.publishedBy === fromId) pub.publishedBy = toId;
  }
  for (const snap of store.publishedCardSnapshots) {
    if (snap.publishedBy === fromId) snap.publishedBy = toId;
  }
  for (const snap of store.tournamentPublishedCards) {
    if (snap.publishedBy === fromId) snap.publishedBy = toId;
  }
}

function identityKeyForUser(user: DevUser): string | null {
  const email = user.email?.trim().toLowerCase() ?? null;
  if (email) return `email:${email}`;
  const phone = normalizePhone(user.phone ?? "");
  if (phone) return `phone:${phone}`;
  return null;
}

function pickKeeperForDuplicateUsers(group: DevUser[]): DevUser {
  const sorted = [...group].sort((a, b) => {
    if (a.role === "PLATFORM" && b.role !== "PLATFORM") return -1;
    if (b.role === "PLATFORM" && a.role !== "PLATFORM") return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return sorted[0]!;
}

function expectedStableUserId(user: DevUser): string | null {
  const email = user.email?.trim().toLowerCase() ?? null;
  const phone = normalizePhone(user.phone ?? "");
  if (!email && !phone) return null;
  return stableUserIdFromDevIdentity({ email, phone });
}

/**
 * 동일 이메일/전화 중복 행 병합, id를 결정적 stable id로 맞추고 참조·legacy 별칭을 갱신한다.
 * 로드 시마다 호출되며, 이미 정합이면 변경 없음.
 */
function reconcileDevStoreUserIds(store: DevStore): boolean {
  let changed = false;
  if (!store.legacyUserIdAliases) store.legacyUserIdAliases = {};

  const byKey = new Map<string, DevUser[]>();
  for (const u of store.users) {
    const key = identityKeyForUser(u);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(u);
    byKey.set(key, list);
  }

  for (const [, list] of byKey) {
    if (list.length <= 1) continue;
    const keeper = pickKeeperForDuplicateUsers(list);
    for (const dup of list) {
      if (dup.id === keeper.id) continue;
      remapUserIdInStore(store, dup.id, keeper.id);
      recordUserIdAlias(store, dup.id, keeper.id);
      store.users = store.users.filter((u) => u.id !== dup.id);
      changed = true;
    }
  }

  for (const user of [...store.users]) {
    const expected = expectedStableUserId(user);
    if (!expected || user.id === expected) continue;
    const conflict = store.users.find((u) => u.id === expected && u !== user);
    if (conflict) {
      remapUserIdInStore(store, user.id, conflict.id);
      recordUserIdAlias(store, user.id, conflict.id);
      store.users = store.users.filter((u) => u.id !== user.id);
      changed = true;
      continue;
    }
    const oldId = user.id;
    remapUserIdInStore(store, oldId, expected);
    recordUserIdAlias(store, oldId, expected);
    user.id = expected;
    user.updatedAt = new Date().toISOString();
    changed = true;
  }

  return changed;
}

function reconcileDevStoreLoginIds(store: DevStore): boolean {
  let changed = false;
  const used = new Set<string>();

  for (const user of store.users) {
    const next = normalizeLoginId(user.loginId) ?? normalizeLoginId(user.email ?? "") ?? null;
    if (!next) continue;
    if (user.loginId !== next) {
      user.loginId = next;
      user.updatedAt = new Date().toISOString();
      changed = true;
    }
    used.add(next);
  }

  for (const user of store.users) {
    if (user.loginId) continue;
    const fallback = normalizeLoginId(user.email ?? "") ?? `user_${user.id.slice(0, 8)}`;
    let candidate = fallback;
    let suffix = 1;
    while (used.has(candidate)) {
      candidate = `${fallback}_${suffix}`;
      suffix += 1;
    }
    user.loginId = candidate;
    user.updatedAt = new Date().toISOString();
    used.add(candidate);
    changed = true;
  }

  return changed;
}

function normalizeTournament(tournament: Tournament, store?: DevStore): Tournament {
  const poster =
    typeof tournament.posterImageUrl === "string" && tournament.posterImageUrl.trim() !== ""
      ? tournament.posterImageUrl.trim()
      : null;
  const summary =
    typeof tournament.summary === "string" && tournament.summary.trim() !== ""
      ? tournament.summary.trim()
      : null;
  const prizeInfo =
    typeof tournament.prizeInfo === "string" && tournament.prizeInfo.trim() !== ""
      ? tournament.prizeInfo.trim()
      : null;

  const m = tournament.outlineDisplayMode;
  const outlineDisplayMode: OutlineDisplayMode | null =
    m === "TEXT" || m === "IMAGE" || m === "PDF" ? m : null;
  const outlineHtml =
    typeof tournament.outlineHtml === "string" && tournament.outlineHtml !== ""
      ? tournament.outlineHtml
      : null;
  const outlineImageUrl =
    typeof tournament.outlineImageUrl === "string" && tournament.outlineImageUrl.trim() !== ""
      ? tournament.outlineImageUrl.trim()
      : null;
  const outlinePdfUrl =
    typeof tournament.outlinePdfUrl === "string" && tournament.outlinePdfUrl.trim() !== ""
      ? tournament.outlinePdfUrl.trim()
      : null;

  const vg = tournament.venueGuideVenueId;
  const venueGuideVenueId = store
    ? resolveVenueGuideVenueIdFromStore(store, vg)
    : typeof vg === "string" && vg.trim() !== "" && isValidSiteVenueId(vg.trim())
      ? vg.trim()
      : null;

  const statusBadge = normalizeTournamentStatusBadge(
    (tournament as Tournament & { statusBadge?: unknown }).statusBadge
  );

  const eventDates = parseTournamentEventDates((tournament as Tournament).eventDates ?? null);
  const extraVenues = parseTournamentExtraVenues((tournament as Tournament).extraVenues ?? null);

  return {
    ...tournament,
    statusBadge,
    eventDates,
    extraVenues,
    maxParticipants: Number.isFinite(Number(tournament.maxParticipants))
      ? Math.max(1, Math.floor(Number(tournament.maxParticipants)))
      : 1,
    entryFee: Number.isFinite(Number(tournament.entryFee)) ? Math.max(0, Math.floor(Number(tournament.entryFee))) : 0,
    posterImageUrl: poster,
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule: normalizeTournamentRule(tournament.rule),
  };
}

function validateTournamentRuleForCreate(rule: TournamentRuleSnapshot): { ok: true } | { ok: false; error: string } {
  const eq = rule.entryQualificationType;
  const needsMetric = eq === "SCORE" || eq === "EVER" || eq === "BOTH";
  if (needsMetric) {
    if (rule.eligibilityValue == null || !Number.isFinite(rule.eligibilityValue)) {
      return { ok: false, error: "참가 조건 기준값을 입력해 주세요." };
    }
  }
  if (rule.verificationMode === "AUTO" && needsMetric) {
    if (rule.eligibilityValue == null || !Number.isFinite(rule.eligibilityValue)) {
      return { ok: false, error: "자동(OCR) 증빙 시 참가 조건 기준값이 필요합니다." };
    }
  }
  if (rule.durationType === "MULTI_DAY") {
    const n = rule.durationDays ?? 0;
    if (n < 2 || n > 10) {
      return { ok: false, error: "대회 기간(일 수)은 2일~10일만 선택할 수 있습니다." };
    }
  }
  if (rule.divisionEnabled) {
    if (!rule.divisionRulesJson || rule.divisionRulesJson.length === 0) {
      return { ok: false, error: "부 자동 배정을 켠 경우 부 규칙을 1개 이상 입력해 주세요." };
    }
  }
  if (rule.isScotch) {
    if (rule.teamScoreLimit == null || !Number.isFinite(rule.teamScoreLimit)) {
      return { ok: false, error: "스카치 대회는 팀 점수 제한을 입력해 주세요." };
    }
  }
  return { ok: true };
}

function normalizeSitePageBuilderDraftSection(
  section: SitePageBuilderDraftSection
): SitePageBuilderDraftSection | null {
  const id = section.id?.trim?.() ?? "";
  const order = Number(section.order);
  if (!id || !Number.isFinite(order) || order <= 0) return null;
  const blocks = Array.isArray(section.blocks)
    ? section.blocks
        .map((block) => {
          const blockId = block.id?.trim?.() ?? "";
          const blockType = block.type?.trim?.() ?? "";
          const blockData =
            block.data && typeof block.data === "object" && !Array.isArray(block.data)
              ? block.data
              : {};
          if (!blockId || !blockType) return null;
          return {
            id: blockId,
            type: blockType,
            data: blockData as Record<string, unknown>,
          };
        })
        .filter((block): block is SitePageBuilderDraftBlock => block !== null)
    : [];
  return {
    id,
    order: Math.floor(order),
    blocks,
  };
}

function deriveRoundStatus(matches: Array<Pick<BracketMatch, "status">>): BracketRoundStatus {
  if (matches.length === 0) return "PENDING";
  const completedCount = matches.filter((match) => match.status === "COMPLETED").length;
  if (completedCount === 0) return "PENDING";
  if (completedCount === matches.length) return "COMPLETED";
  return "IN_PROGRESS";
}

function applyBracketDefaultsInPlace(bracket: MutableBracket): void {
  bracket.rounds = (bracket.rounds ?? []).map((round, roundIndex) => {
    const normalizedMatches = (round.matches ?? []).map((match) => {
      const winnerUserId = match.winnerUserId ?? null;
      const winnerName = match.winnerName ?? null;
      const status: BracketMatchStatus = match.status ?? (winnerUserId ? "COMPLETED" : "PENDING");
      return {
        ...match,
        winnerUserId,
        winnerName,
        status,
      };
    });

    const status = deriveRoundStatus(normalizedMatches);
    return {
      ...round,
      roundNumber: round.roundNumber ?? roundIndex + 1,
      matches: normalizedMatches,
      status,
    };
  });
}

function normalizeBracket(bracket: Bracket): Bracket {
  const mutable = {
    ...bracket,
    rounds: (bracket.rounds ?? []).map((round) => ({
      ...round,
      matches: (round.matches ?? []).map((match) => ({ ...match })),
    })),
  } as MutableBracket;
  applyBracketDefaultsInPlace(mutable);
  return mutable as Bracket;
}

export async function createUser(params: {
  name: string;
  loginId: string;
  nickname: string;
  email?: string;
  phone?: string;
  password: string;
  /** 생략 시 true */
  pushMarketingAgreed?: boolean;
}): Promise<{ ok: true; user: DevUser } | { ok: false; error: string }> {
  const name = params.name.trim();
  const loginId = normalizeLoginId(params.loginId);
  const password = params.password.trim();
  const email = normalizeOptional(params.email)?.toLowerCase() ?? null;
  const phone = normalizePhone(params.phone);
  const nickResult = parseNicknameInput(params.nickname);

  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!loginId) return { ok: false, error: "아이디를 입력해 주세요." };
  if (!password) return { ok: false, error: "비밀번호를 입력해 주세요." };
  if (!nickResult.ok) return { ok: false, error: nickResult.error };

  if (process.env.NODE_ENV === "production") {
    if (!isFirestoreUsersBackendConfigured()) {
      console.error(
        "[dev-store] production 회원가입: Firestore 자격 증명(FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)이 없습니다."
      );
      return { ok: false, error: "일시적으로 가입을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." };
    }
    try {
      const duplicatedFs = await firestoreHasDuplicateIdentity({
        loginIdNorm: loginId,
        email,
        phoneDigits: phone,
      });
      if (duplicatedFs) {
        return { ok: false, error: "이미 가입된 계정 정보입니다." };
      }
      const nickKey = nicknameCompareKey(nickResult.nickname);
      if (await firestoreIsNicknameKeyTaken(nickKey)) {
        return { ok: false, error: "이미 사용중" };
      }
      const now = new Date().toISOString();
      const pushMarketingAgreed = typeof params.pushMarketingAgreed === "boolean" ? params.pushMarketingAgreed : true;
      const newUser: DevUser = {
        id: stableUserIdFromDevIdentity({ email, phone }),
        loginId,
        nickname: nickResult.nickname,
        name,
        email,
        phone,
        password,
        role: "USER",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        linkedVenueId: null,
        pushMarketingAgreed,
      };
      await firestoreCreateUser(newUser);
      return { ok: true, user: newUser };
    } catch (e) {
      console.error("[dev-store] createUser Firestore 저장 실패", e);
      return { ok: false, error: "회원가입 처리 중 오류가 발생했습니다." };
    }
  }

  const store = await readStore();
  const duplicated = store.users.some((user) => {
    const uPhone = normalizePhone(user.phone ?? "");
    return (
      user.loginId.toLowerCase() === loginId ||
      (email && user.email === email) ||
      (phone && uPhone === phone)
    );
  });
  if (duplicated) {
    return { ok: false, error: "이미 가입된 계정 정보입니다." };
  }
  if (isNicknameKeyTakenInStore(store, nicknameCompareKey(nickResult.nickname))) {
    return { ok: false, error: "이미 사용중" };
  }

  const now = new Date().toISOString();
  const pushMarketingAgreed = typeof params.pushMarketingAgreed === "boolean" ? params.pushMarketingAgreed : true;
  const newUser: DevUser = {
    id: stableUserIdFromDevIdentity({ email, phone }),
    loginId,
    nickname: nickResult.nickname,
    name,
    email,
    phone,
    password,
    role: "USER",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    linkedVenueId: null,
    pushMarketingAgreed,
  };

  store.users.push(newUser);
  await writeStore(store);
  return { ok: true, user: newUser };
}

export async function findUserByIdentifier(identifier: string): Promise<DevUser | null> {
  const loginId = normalizeLoginId(identifier);
  if (!loginId) return null;

  if (useFirestoreUsersInProduction()) {
    try {
      const u = await firestoreFindByLoginIdNorm(loginId);
      if (u) return u;
    } catch (e) {
      console.error("[dev-store] findUserByIdentifier Firestore 조회 실패", e);
    }
  }

  const store = await readStore();
  return store.users.find((item) => item.loginId.toLowerCase() === loginId) ?? null;
}

/** 전화번호로 계정 조회 (정규화된 번호 기준, 아이디 찾기). 동일 번호는 스토어에서 유일해야 함 */
export async function findUserByPhone(phone: string): Promise<DevUser | null> {
  const p = normalizePhone(phone);
  if (!p) return null;
  if (useFirestoreUsersInProduction()) {
    try {
      const u = await firestoreFindByPhoneDigits(p);
      if (u) return u;
    } catch (e) {
      console.error("[dev-store] findUserByPhone Firestore 조회 실패", e);
    }
  }
  const store = await readStore();
  const matches = store.users.filter((u) => normalizePhone(u.phone ?? "") === p);
  if (matches.length === 0) return null;
  return matches[0] ?? null;
}

/** 아이디 + 전화번호 일치 (비밀번호 재설정 본인 확인) */
export async function findUserByLoginIdAndPhone(loginId: string, phone: string): Promise<DevUser | null> {
  const p = normalizePhone(phone);
  if (!p) return null;
  const raw = loginId.trim().toLowerCase();
  if (!raw) return null;
  if (useFirestoreUsersInProduction()) {
    try {
      const u = await firestoreFindByLoginIdAndPhoneDigits(raw, p);
      if (u) return u;
    } catch (e) {
      console.error("[dev-store] findUserByLoginIdAndPhone Firestore 조회 실패", e);
    }
  }
  const store = await readStore();
  return (
    store.users.find((u) => {
      const uLogin = (u.loginId || "").trim().toLowerCase();
      return uLogin === raw && normalizePhone(u.phone ?? "") === p;
    }) ?? null
  );
}

export function maskLoginIdForDisplay(loginId: string): string {
  const s = loginId.trim();
  if (!s) return "";
  if (s.length <= 2) return "*".repeat(s.length);
  if (s.length <= 4) return s[0] + "*".repeat(s.length - 1);
  return s.slice(0, 2) + "*".repeat(Math.min(5, s.length - 3)) + s.slice(-1);
}

export async function updateUserPasswordByUserId(userId: string, newPassword: string): Promise<boolean> {
  const pw = newPassword.trim();
  if (!pw) return false;
  if (useFirestoreUsersInProduction()) {
    try {
      const ok = await firestoreUpdatePassword(userId, pw);
      if (ok) return true;
    } catch (e) {
      console.error("[dev-store] updateUserPasswordByUserId Firestore 실패", e);
    }
  }
  const store = await readStore();
  const user = findUserByRawId(store, userId);
  if (!user) return false;
  user.password = pw;
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}

export async function getUserById(userId: string): Promise<DevUser | null> {
  if (useFirestoreUsersInProduction()) {
    try {
      const u = await firestoreGetUserById(userId);
      if (u) return u;
    } catch (e) {
      console.error("[dev-store] getUserById Firestore 조회 실패", e);
    }
  }
  const store = await readStore();
  return findUserByRawId(store, userId);
}

export async function updateUserRole(userId: string, role: AuthRole): Promise<DevUser | null> {
  const store = await readStore();
  const user = findUserByRawId(store, userId);
  if (!user) return null;
  user.role = role;
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  return user;
}

export async function listPlatformUsersForPlatform(params?: {
  search?: string;
  role?: AuthRole | "all";
  status?: PlatformUserStatus | "all";
}): Promise<PlatformUserListItem[]> {
  const store = await readStore();
  const search = (params?.search ?? "").trim().toLowerCase();
  const role = params?.role ?? "all";
  const status = params?.status ?? "all";

  return store.users
    .map((user) => {
      const canonicalId = resolveCanonicalUserId(store, user.id);
      const org = store.clientOrganizations.find((item) => item.clientUserId === canonicalId) ?? null;
      const userStatus: PlatformUserStatus =
        user.status === "SUSPENDED" || user.status === "DELETED" ? user.status : "ACTIVE";
      return {
        id: user.id,
        name: user.name,
        loginId: user.loginId,
        email: user.email,
        role: user.role,
        status: userStatus,
        orgClientType: org?.clientType ?? null,
        orgApprovalStatus: org?.approvalStatus ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    })
    .filter((row) => (role === "all" ? true : row.role === role))
    .filter((row) => (status === "all" ? true : row.status === status))
    .filter((row) => {
      if (!search) return true;
      const target = `${row.name} ${row.loginId} ${row.email ?? ""}`.toLowerCase();
      return target.includes(search);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function patchPlatformUserForPlatform(
  userId: string,
  params: {
    role?: AuthRole;
    status?: PlatformUserStatus;
    orgClientType?: ClientOrganizationType;
    orgApprovalStatus?: ClientOrganizationApprovalStatus;
  }
): Promise<PlatformUserListItem | null> {
  const store = await readStore();
  const targetUserId = userId.trim();
  const user = findUserByRawId(store, targetUserId);
  if (!user) return null;

  if (params.role === "USER" || params.role === "CLIENT" || params.role === "PLATFORM") {
    user.role = params.role;
  }
  if (params.status === "ACTIVE" || params.status === "SUSPENDED" || params.status === "DELETED") {
    user.status = params.status;
  }

  const now = new Date().toISOString();
  user.updatedAt = now;
  const canonicalId = resolveCanonicalUserId(store, user.id);
  const orgIdx = store.clientOrganizations.findIndex((item) => item.clientUserId === canonicalId);
  if (orgIdx >= 0) {
    const currentOrg = store.clientOrganizations[orgIdx];
    const nextOrg: ClientOrganizationStored = {
      ...currentOrg,
      clientType: params.orgClientType ?? currentOrg.clientType,
      approvalStatus: params.orgApprovalStatus ?? currentOrg.approvalStatus,
      updatedAt: now,
    };
    store.clientOrganizations[orgIdx] = nextOrg;
  }

  await writeStore(store);
  const org = orgIdx >= 0 ? store.clientOrganizations[orgIdx] : null;
  return {
    id: user.id,
    name: user.name,
    loginId: user.loginId,
    email: user.email,
    role: user.role,
    status: user.status === "SUSPENDED" || user.status === "DELETED" ? user.status : "ACTIVE",
    orgClientType: org?.clientType ?? null,
    orgApprovalStatus: org?.approvalStatus ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function updateUserProfile(params: {
  userId: string;
  name: string;
  nickname: string;
  phone?: string;
  password?: string;
  pushMarketingAgreed?: boolean;
}): Promise<{ ok: true; user: DevUser } | { ok: false; error: string }> {
  const userId = params.userId.trim();
  const name = params.name.trim();
  const phone = normalizePhone(params.phone);
  const password = params.password?.trim() ?? "";
  const nickResult = parseNicknameInput(params.nickname);

  if (!userId) return { ok: false, error: "잘못된 요청입니다." };
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!nickResult.ok) return { ok: false, error: nickResult.error };

  if (useFirestoreUsersInProduction()) {
    try {
      const fsUser = await firestoreGetUserById(userId);
      if (fsUser) {
        const store = await readStore();
        const newKey = nicknameCompareKey(nickResult.nickname);
        const currentKey = nicknameCompareKey(fsUser.nickname);
        if (newKey !== currentKey) {
          if (await firestoreIsNicknameKeyTaken(newKey, userId)) {
            return { ok: false, error: "이미 사용중" };
          }
          if (isNicknameKeyTakenInStore(store, newKey, userId)) {
            return { ok: false, error: "이미 사용중" };
          }
        }
        if (phone) {
          const dupFile = store.users.some(
            (item) => item.id !== userId && normalizePhone(item.phone ?? "") === phone
          );
          if (dupFile) {
            return { ok: false, error: "이미 사용 중인 전화번호입니다." };
          }
          if (await firestoreHasOtherUserWithPhoneDigits(phone, userId)) {
            return { ok: false, error: "이미 사용 중인 전화번호입니다." };
          }
        }
        fsUser.name = name;
        fsUser.nickname = nickResult.nickname;
        fsUser.phone = phone;
        if (password) {
          fsUser.password = password;
        }
        if (typeof params.pushMarketingAgreed === "boolean") {
          fsUser.pushMarketingAgreed = params.pushMarketingAgreed;
        }
        fsUser.updatedAt = new Date().toISOString();
        await firestoreReplaceUser(fsUser);
        return { ok: true, user: fsUser };
      }
    } catch (e) {
      console.error("[dev-store] updateUserProfile Firestore 실패", e);
      return { ok: false, error: "프로필 저장 중 오류가 발생했습니다." };
    }
  }

  const store = await readStore();
  const user = findUserByRawId(store, userId);
  if (!user) {
    return { ok: false, error: "사용자를 찾을 수 없습니다." };
  }

  const newKey = nicknameCompareKey(nickResult.nickname);
  const currentKey = nicknameCompareKey(user.nickname);
  if (newKey !== currentKey && isNicknameKeyTakenInStore(store, newKey, userId)) {
    return { ok: false, error: "이미 사용중" };
  }

  const hasDuplicatedPhone = phone
    ? store.users.some((item) => item.id !== userId && normalizePhone(item.phone ?? "") === phone)
    : false;
  if (hasDuplicatedPhone) {
    return { ok: false, error: "이미 사용 중인 전화번호입니다." };
  }

  user.name = name;
  user.nickname = nickResult.nickname;
  user.phone = phone;
  if (password) {
    user.password = password;
  }
  if (typeof params.pushMarketingAgreed === "boolean") {
    user.pushMarketingAgreed = params.pushMarketingAgreed;
  }
  user.updatedAt = new Date().toISOString();

  await writeStore(store);
  return { ok: true, user };
}

export async function ensurePlatformAdminAccount(params: {
  loginId: string;
  email: string;
  password: string;
  name?: string;
}): Promise<DevUser | null> {
  const loginId = normalizeLoginId(params.loginId);
  const email = params.email.trim().toLowerCase();
  const password = params.password.trim();
  const name = params.name?.trim() || "플랫폼 관리자";
  if (!loginId || !password) return null;

  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.users.find((user) => user.loginId.toLowerCase() === loginId);
  if (existing) {
    if (existing.email !== email) existing.email = email;
    // 기존 사용자면 role만 PLATFORM으로 승격한다.
    if (existing.role !== "PLATFORM") {
      existing.role = "PLATFORM";
      existing.updatedAt = now;
      await writeStore(store);
    }
    return existing;
  }

  const created: DevUser = {
    id: stableUserIdFromDevIdentity({ email, phone: null }),
    loginId,
    nickname: loginId,
    name,
    email,
    phone: null,
    password,
    role: "PLATFORM",
    createdAt: now,
    updatedAt: now,
    linkedVenueId: null,
    pushMarketingAgreed: true,
  };
  store.users.push(created);
  await writeStore(store);
  return created;
}

export async function getLatestClientApplicationByUserId(userId: string): Promise<ClientApplication | null> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  const target = store.clientApplications
    .filter((item) => item.userId === canonical)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return target ?? null;
}

export async function createClientApplication(params: {
  userId: string;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  requestedClientType?: ClientRequestedType;
}): Promise<{ ok: true; application: ClientApplication } | { ok: false; error: string }> {
  const organizationName = params.organizationName.trim();
  const contactName = params.contactName.trim();
  const contactPhone = params.contactPhone.trim();

  if (!organizationName) return { ok: false, error: "조직명을 입력해 주세요." };
  if (!contactName) return { ok: false, error: "담당자명을 입력해 주세요." };
  if (!contactPhone) return { ok: false, error: "담당자 연락처를 입력해 주세요." };

  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, params.userId.trim());
  const existing = store.clientApplications
    .filter((item) => item.userId === canonicalUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (existing?.status === "PENDING") {
    return { ok: false, error: "이미 승인 대기 중인 신청이 있습니다." };
  }
  if (existing?.status === "APPROVED") {
    return { ok: false, error: "이미 승인 완료된 클라이언트 계정입니다." };
  }

  const now = new Date().toISOString();
  const requestedClientType: ClientRequestedType =
    params.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL";
  const application: ClientApplication = {
    id: randomUUID(),
    userId: canonicalUserId,
    organizationName,
    contactName,
    contactPhone,
    requestedClientType,
    status: "PENDING",
    rejectedReason: null,
    reviewedAt: null,
    reviewedByUserId: null,
    createdAt: now,
    updatedAt: now,
  };

  store.clientApplications.push(application);
  const user = findUserByRawId(store, params.userId);
  if (user) {
    user.role = "CLIENT";
    user.updatedAt = now;
  }
  await writeStore(store);
  return { ok: true, application };
}

export async function listClientApplications(): Promise<ClientApplication[]> {
  const store = await readStore();
  return [...store.clientApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mapApplicationStatusToOrgApprovalStatus(
  status: ClientApplicationStatus
): ClientOrganizationApprovalStatus {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

export async function updateClientApplicationStatus(
  applicationId: string,
  params: {
    status: ClientApplicationStatus;
    reviewedByUserId: string;
    rejectedReason?: string | null;
  }
): Promise<ClientApplication | null> {
  const store = await readStore();
  const application = store.clientApplications.find((item) => item.id === applicationId);
  if (!application) return null;

  const now = new Date().toISOString();
  application.status = params.status;
  application.reviewedAt = now;
  application.reviewedByUserId = params.reviewedByUserId.trim() || null;
  application.rejectedReason =
    params.status === "REJECTED"
      ? params.rejectedReason === undefined
        ? application.rejectedReason
        : params.rejectedReason != null && String(params.rejectedReason).trim() !== ""
          ? String(params.rejectedReason).trim()
          : null
      : null;
  application.updatedAt = now;

  const user = findUserByRawId(store, application.userId);
  if (user) {
    user.role = "CLIENT";
    user.updatedAt = now;
  }

  const canonicalUserId = resolveCanonicalUserId(store, application.userId);
  const requestedType: ClientRequestedType =
    application.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL";
  const existingOrgIdx = store.clientOrganizations.findIndex((row) => row.clientUserId === canonicalUserId);
  const mappedApproval = mapApplicationStatusToOrgApprovalStatus(params.status);

  if (existingOrgIdx >= 0) {
    const current = store.clientOrganizations[existingOrgIdx];
    const next: ClientOrganizationStored = {
      ...current,
      name: current.name?.trim() ? current.name : application.organizationName,
      slug: resolveClientOrgSlug(current, current.id),
      phone: current.phone ?? application.contactPhone,
      clientType: requestedType === "REGISTERED" ? "REGISTERED" : "GENERAL",
      approvalStatus: mappedApproval,
      membershipType: requestedType === "REGISTERED" ? "ANNUAL" : "NONE",
      membershipExpireAt: requestedType === "REGISTERED" ? current.membershipExpireAt : null,
      updatedAt: now,
    };
    if (params.status === "APPROVED" && next.status !== "SUSPENDED" && next.status !== "EXPELLED") {
      next.status = "ACTIVE";
    }
    store.clientOrganizations[existingOrgIdx] = next;
  } else {
    const newOrgId = `client-org-${canonicalUserId}`;
    const newOrg: ClientOrganizationStored = {
      clientUserId: canonicalUserId,
      id: newOrgId,
      slug: `${newOrgId}_client`,
      name: application.organizationName,
      type: "VENUE",
      shortDescription: null,
      description: null,
      fullDescription: null,
      logoImageUrl: null,
      coverImageUrl: null,
      phone: application.contactPhone,
      email: null,
      website: null,
      address: null,
      addressDetail: null,
      addressJibun: null,
      zipCode: null,
      latitude: null,
      longitude: null,
      addressNaverMapEnabled: false,
      region: null,
      typeSpecificJson: null,
      clientType: requestedType === "REGISTERED" ? "REGISTERED" : "GENERAL",
      approvalStatus: mappedApproval,
      status: "ACTIVE",
      adminRemarks: null,
      membershipType: requestedType === "REGISTERED" ? "ANNUAL" : "NONE",
      membershipExpireAt: null,
      isPublished: false,
      setupCompleted: false,
      createdAt: now,
      updatedAt: now,
    };
    store.clientOrganizations.push(newOrg);
  }

  await writeStore(store);
  return application;
}

export async function getClientStatusByUserId(userId: string): Promise<ClientApplicationStatus | null> {
  const latest = await getLatestClientApplicationByUserId(userId);
  return latest?.status ?? null;
}

export async function getPlatformOperationSettings(): Promise<PlatformOperationSettings> {
  const readStrategy = resolvePlatformOperationSettingsReadStrategy();
  if (readStrategy === "firestore-kv") {
    try {
      const raw = await readPlatformOperationSettingsRawFromFirestoreKv();
      if (raw != null) return normalizePlatformOperationSettings(raw);
    } catch (e) {
      console.warn("[dev-store] getPlatformOperationSettings Firestore read failed; using defaults", e);
    }
    return normalizePlatformOperationSettings(undefined);
  }
  if (readStrategy === "production-defaults-only") {
    return normalizePlatformOperationSettings(undefined);
  }
  const store = await readStore();
  return normalizePlatformOperationSettings(store.platformOperationSettings);
}

export async function patchPlatformOperationSettings(params: {
  annualMembershipVisible?: boolean;
  annualMembershipEnforced?: boolean;
}): Promise<PlatformOperationSettings> {
  const writeStrategy = resolvePlatformOperationSettingsWriteStrategy();
  if (writeStrategy === "firestore-kv") {
    const raw = await readPlatformOperationSettingsRawFromFirestoreKv();
    const current = normalizePlatformOperationSettings(raw ?? undefined);
    const requestedVisible = params.annualMembershipVisible ?? current.annualMembershipVisible;
    const requestedEnforced = params.annualMembershipEnforced ?? current.annualMembershipEnforced;
    // 운영 정책 강제: enforced가 ON이면 visible은 자동으로 ON.
    const normalizedVisible = requestedEnforced ? true : requestedVisible;
    const next: PlatformOperationSettings = {
      annualMembershipVisible: normalizedVisible,
      annualMembershipEnforced: requestedEnforced,
      updatedAt: new Date().toISOString(),
    };
    await upsertPlatformOperationSettingsToFirestoreKv(next);
    return next;
  }
  if (writeStrategy === "blocked") {
    throwPlatformOperationSettingsWritePersistenceBlocked();
  }
  const store = await readStore();
  const current = normalizePlatformOperationSettings(store.platformOperationSettings);
  const requestedVisible = params.annualMembershipVisible ?? current.annualMembershipVisible;
  const requestedEnforced = params.annualMembershipEnforced ?? current.annualMembershipEnforced;
  // 운영 정책 강제: enforced가 ON이면 visible은 자동으로 ON.
  const normalizedVisible = requestedEnforced ? true : requestedVisible;
  const next: PlatformOperationSettings = {
    annualMembershipVisible: normalizedVisible,
    annualMembershipEnforced: requestedEnforced,
    updatedAt: new Date().toISOString(),
  };
  store.platformOperationSettings = next;
  await writeStore(store);
  return next;
}

function membershipStateOfOrg(org: ClientOrganizationStored): "NONE" | "ACTIVE" | "EXPIRED" {
  if (org.membershipType !== "ANNUAL") return "NONE";
  if (!org.membershipExpireAt) return "ACTIVE";
  return new Date(org.membershipExpireAt).getTime() >= Date.now() ? "ACTIVE" : "EXPIRED";
}

export async function getClientDashboardPolicy(userId: string): Promise<{
  orgStatus: ClientOrganizationStatus | null;
  membershipType: ClientMembershipType;
  membershipState: "NONE" | "ACTIVE" | "EXPIRED";
  annualMembershipVisible: boolean;
  annualMembershipEnforced: boolean;
}> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  const org = store.clientOrganizations.find((row) => row.clientUserId === canonical) ?? null;
  const settings = await getPlatformOperationSettings();
  return {
    orgStatus: org?.status ?? null,
    membershipType: org?.membershipType === "ANNUAL" ? "ANNUAL" : "NONE",
    membershipState: org ? membershipStateOfOrg(org) : "NONE",
    annualMembershipVisible: settings.annualMembershipVisible,
    annualMembershipEnforced: settings.annualMembershipEnforced,
  };
}

export async function checkClientFeatureAccessByUserId(params: {
  userId: string;
  feature: "SETTLEMENT" | "BRACKET";
}): Promise<
  | { ok: true; policy: Awaited<ReturnType<typeof getClientDashboardPolicy>> }
  | { ok: false; error: string; policy: Awaited<ReturnType<typeof getClientDashboardPolicy>> }
> {
  const currentUser = await getUserById(params.userId);
  const clientStatus = await getClientStatusByUserId(params.userId);
  const policy = await getClientDashboardPolicy(params.userId);
  // 1) role
  if (!currentUser || (currentUser.role !== "CLIENT" && currentUser.role !== "PLATFORM")) {
    return { ok: false, error: "클라이언트 권한이 없습니다.", policy };
  }
  // 2) 사용자 상태
  if (currentUser.status === "SUSPENDED" || currentUser.status === "DELETED") {
    return { ok: false, error: "현재 이용이 제한된 상태입니다. 관리자에게 문의하세요", policy };
  }
  // 3) 조직 승인/상태
  if (clientStatus !== "APPROVED") {
    return { ok: false, error: "승인 완료된 클라이언트만 접근할 수 있습니다.", policy };
  }
  if (policy.orgStatus === "SUSPENDED" || policy.orgStatus === "EXPELLED") {
    return { ok: false, error: "현재 이용이 제한된 상태입니다. 관리자에게 문의하세요", policy };
  }
  // 4) 연회원 정책
  if (policy.annualMembershipEnforced && policy.membershipState !== "ACTIVE") {
    return { ok: false, error: "이 기능은 연회원 전용입니다. 연회원 가입 후 이용 가능합니다", policy };
  }
  return { ok: true, policy };
}

export async function listApprovedClientOrganizations(params?: {
  status?: ClientOrganizationStatus | "all";
  clientType?: ClientOrganizationType | "all";
}): Promise<ClientOrganizationStored[]> {
  const store = await readStore();
  const status = params?.status ?? "all";
  const clientType = params?.clientType ?? "all";
  return store.clientOrganizations
    .filter((row) => row.approvalStatus === "APPROVED")
    .filter((row) => (status === "all" ? true : row.status === status))
    .filter((row) => (clientType === "all" ? true : row.clientType === clientType))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getClientOrganizationByIdForPlatform(orgId: string): Promise<ClientOrganizationStored | null> {
  const store = await readStore();
  const id = orgId.trim();
  return store.clientOrganizations.find((row) => row.id === id) ?? null;
}

export async function patchClientOrganizationForPlatform(
  orgId: string,
  params: {
    status?: ClientOrganizationStatus;
    clientType?: ClientOrganizationType;
    membershipType?: ClientMembershipType;
    membershipExpireAt?: string | null;
    adminRemarks?: string | null;
  }
): Promise<ClientOrganizationStored | null> {
  const store = await readStore();
  const id = orgId.trim();
  const idx = store.clientOrganizations.findIndex((row) => row.id === id);
  if (idx < 0) return null;
  const current = store.clientOrganizations[idx];
  const nextMembershipType = params.membershipType ?? current.membershipType;
  const nextMembershipExpireAt =
    params.membershipExpireAt !== undefined
      ? params.membershipExpireAt && params.membershipExpireAt.trim()
        ? params.membershipExpireAt.trim()
        : null
      : current.membershipExpireAt;
  const next: ClientOrganizationStored = {
    ...current,
    status: params.status ?? current.status,
    clientType: params.clientType ?? current.clientType,
    membershipType: nextMembershipType,
    membershipExpireAt: nextMembershipType === "ANNUAL" ? nextMembershipExpireAt : null,
    adminRemarks:
      params.adminRemarks !== undefined
        ? params.adminRemarks && params.adminRemarks.trim()
          ? params.adminRemarks.trim()
          : null
        : current.adminRemarks,
    updatedAt: new Date().toISOString(),
  };
  store.clientOrganizations[idx] = next;
  await writeStore(store);
  return next;
}

export async function getClientOrganizationByUserId(userId: string): Promise<ClientOrganizationStored | null> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  return store.clientOrganizations.find((o) => o.clientUserId === canonical) ?? null;
}

export async function getClientInquiryById(id: string): Promise<ClientInquiryStored | null> {
  const store = await readStore();
  const tid = id.trim();
  return store.clientInquiries.find((x) => x.id === tid) ?? null;
}

export async function getClientInquiryByIdForClientUser(
  inquiryId: string,
  clientUserId: string
): Promise<ClientInquiryStored | null> {
  const store = await readStore();
  const tid = inquiryId.trim();
  const row = store.clientInquiries.find((x) => x.id === tid) ?? null;
  if (!row) return null;
  const c1 = resolveCanonicalUserId(store, row.clientUserId);
  const c2 = resolveCanonicalUserId(store, clientUserId.trim());
  return c1 === c2 ? row : null;
}

export async function listClientInquiriesByClientUserId(userId: string): Promise<ClientInquiryStored[]> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  return store.clientInquiries
    .filter((x) => resolveCanonicalUserId(store, x.clientUserId) === canonical)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 클라이언트 목록: 관리자(플랫폼) 댓글 여부 — 답변대기/답변완료 표시용 */
export async function listClientInquiriesByClientUserIdWithAdminReplyFlag(
  userId: string
): Promise<Array<{ inquiry: ClientInquiryStored; hasAdminReply: boolean }>> {
  const rows = await listClientInquiriesByClientUserId(userId);
  const store = await readStore();
  return rows.map((inquiry) => ({
    inquiry,
    hasAdminReply: store.inquiryComments.some(
      (c) => c.inquiryId === inquiry.id && c.authorRole === "PLATFORM"
    ),
  }));
}

export async function listClientInquiriesForPlatform(params?: {
  type?: ClientInquiryType;
}): Promise<ClientInquiryStored[]> {
  const store = await readStore();
  let rows = [...store.clientInquiries];
  if (params?.type === "ERROR" || params?.type === "FEATURE") {
    rows = rows.filter((x) => x.type === params.type);
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 플랫폼 문의 화면용: 발신자·연락처·소속 표시문구 (내부 id 대신 사람이 읽는 값) */
export type ClientInquiryPlatformDisplayFields = {
  senderName: string;
  contactDisplay: string;
  organizationDisplay: string;
};

function resolveClientInquiryPlatformDisplayFromStore(
  store: DevStore,
  row: ClientInquiryStored
): ClientInquiryPlatformDisplayFields {
  const uid = resolveCanonicalUserId(store, row.clientUserId);
  const user = store.users.find((u) => u.id === uid) ?? null;

  let org: ClientOrganizationStored | null = null;
  if (row.clientOrganizationId) {
    const oid = row.clientOrganizationId.trim();
    org = store.clientOrganizations.find((o) => o.id === oid) ?? null;
  }
  if (!org) {
    org = store.clientOrganizations.find((o) => o.clientUserId === uid) ?? null;
  }

  const nameFromUser = user?.name?.trim() ?? "";
  const nickFromUser = user?.nickname?.trim() ?? "";
  const senderName = nameFromUser || nickFromUser || "이름 없음";

  const phone = (user?.phone?.trim() || org?.phone?.trim() || "") || "";
  const email = (user?.email?.trim() || org?.email?.trim() || "") || "";
  let contactDisplay = "연락처 없음";
  if (phone && email) contactDisplay = `${phone} · ${email}`;
  else if (phone) contactDisplay = phone;
  else if (email) contactDisplay = email;

  const organizationDisplay = org?.name?.trim() ? org.name.trim() : "소속 없음";

  return { senderName, contactDisplay, organizationDisplay };
}

export async function resolveClientInquiryPlatformDisplay(
  row: ClientInquiryStored
): Promise<ClientInquiryPlatformDisplayFields> {
  const store = await readStore();
  return resolveClientInquiryPlatformDisplayFromStore(store, row);
}

export async function resolveClientInquiryPlatformDisplayBatch(
  rows: ClientInquiryStored[]
): Promise<ClientInquiryPlatformDisplayFields[]> {
  const store = await readStore();
  return rows.map((row) => resolveClientInquiryPlatformDisplayFromStore(store, row));
}

function authorLabelForInquiryComment(
  store: DevStore,
  role: ClientInquiryCommentAuthorRole,
  authorUserId: string
): string {
  const uid = resolveCanonicalUserId(store, authorUserId);
  const u = store.users.find((x) => x.id === uid) ?? null;
  if (!u) return "알 수 없음";
  const n = (u.name?.trim() || u.nickname?.trim()) || "";
  if (role === "PLATFORM") return n || "관리자";
  return n || "알 수 없음";
}

export async function listClientInquiryCommentViewsForInquiry(inquiryId: string): Promise<ClientInquiryCommentView[]> {
  const store = await readStore();
  const tid = inquiryId.trim();
  const rows = store.inquiryComments
    .filter((c) => c.inquiryId === tid)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return rows.map((c) => ({
    id: c.id,
    authorRole: c.authorRole,
    authorLabel: authorLabelForInquiryComment(store, c.authorRole, c.authorUserId),
    body: c.body,
    imageUrls: c.imageUrls,
    createdAt: c.createdAt,
  }));
}

export async function appendClientInquiryCommentAsClient(params: {
  inquiryId: string;
  clientUserId: string;
  body: string;
  imageUrls: string[];
}): Promise<{ ok: true; comment: ClientInquiryCommentStored } | { ok: false; error: string }> {
  const body = params.body.trim();
  if (!body) return { ok: false, error: "내용을 입력해 주세요." };
  if (body.length > 10000) return { ok: false, error: "내용은 10000자 이하로 입력해 주세요." };
  const imageUrls = normalizeInquiryCommentImageUrls(params.imageUrls);
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, params.clientUserId.trim());
  const inv = store.clientInquiries.find((x) => x.id === params.inquiryId.trim()) ?? null;
  if (!inv) return { ok: false, error: "문의를 찾을 수 없습니다." };
  if (resolveCanonicalUserId(store, inv.clientUserId) !== canonical) {
    return { ok: false, error: "권한이 없습니다." };
  }
  const now = new Date().toISOString();
  const comment: ClientInquiryCommentStored = {
    id: randomUUID(),
    inquiryId: inv.id,
    authorRole: "CLIENT",
    authorUserId: canonical,
    body,
    imageUrls,
    createdAt: now,
  };
  store.inquiryComments.push(comment);
  const invIdx = store.clientInquiries.findIndex((x) => x.id === inv.id);
  if (invIdx >= 0) {
    store.clientInquiries[invIdx] = { ...store.clientInquiries[invIdx]!, updatedAt: now };
  }
  await writeStore(store);
  return { ok: true, comment };
}

export async function appendClientInquiryCommentAsPlatform(params: {
  inquiryId: string;
  platformUserId: string;
  body: string;
  imageUrls: string[];
  status?: ClientInquiryStatus | null;
}): Promise<
  { ok: true; comment: ClientInquiryCommentStored; inquiry: ClientInquiryStored } | { ok: false; error: string }
> {
  const body = params.body.trim();
  if (!body) return { ok: false, error: "내용을 입력해 주세요." };
  if (body.length > 10000) return { ok: false, error: "내용은 10000자 이하로 입력해 주세요." };
  const imageUrls = normalizeInquiryCommentImageUrls(params.imageUrls);
  const store = await readStore();
  const uid = resolveCanonicalUserId(store, params.platformUserId.trim());
  const u = store.users.find((x) => x.id === uid) ?? null;
  if (!u || u.role !== "PLATFORM") return { ok: false, error: "권한이 없습니다." };
  const idx = store.clientInquiries.findIndex((x) => x.id === params.inquiryId.trim());
  if (idx < 0) return { ok: false, error: "문의를 찾을 수 없습니다." };
  const inv = store.clientInquiries[idx]!;
  const now = new Date().toISOString();
  const comment: ClientInquiryCommentStored = {
    id: randomUUID(),
    inquiryId: inv.id,
    authorRole: "PLATFORM",
    authorUserId: uid,
    body,
    imageUrls,
    createdAt: now,
  };
  store.inquiryComments.push(comment);
  const st = params.status;
  const nextInquiry: ClientInquiryStored =
    st === "OPEN" || st === "CHECKED" || st === "DONE"
      ? { ...inv, status: st, updatedAt: now }
      : { ...inv, updatedAt: now };
  store.clientInquiries[idx] = nextInquiry;
  await writeStore(store);
  return { ok: true, comment, inquiry: nextInquiry };
}

export async function createClientInquiry(params: {
  clientUserId: string;
  type: ClientInquiryType;
  title: string;
  body: string;
  imageUrls: string[];
}): Promise<{ ok: true; inquiry: ClientInquiryStored } | { ok: false; error: string }> {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title) return { ok: false, error: "제목을 입력해 주세요." };
  if (!body) return { ok: false, error: "내용을 입력해 주세요." };
  if (title.length > 200) return { ok: false, error: "제목은 200자 이하로 입력해 주세요." };
  if (body.length > 20000) return { ok: false, error: "내용은 20000자 이하로 입력해 주세요." };
  const imageUrls = normalizeInquiryImageUrls(params.imageUrls);
  if (params.type === "ERROR" && imageUrls.length === 0) {
    return { ok: false, error: "오류 제보는 화면 캡처 등 이미지를 1장 이상 첨부해 주세요." };
  }
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, params.clientUserId.trim());
  const org = await getClientOrganizationByUserId(canonical);
  const now = new Date().toISOString();
  const row: ClientInquiryStored = {
    id: randomUUID(),
    clientUserId: canonical,
    clientOrganizationId: org?.id ?? null,
    type: params.type,
    title,
    body,
    imageUrls,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  };
  store.clientInquiries.push(row);
  await writeStore(store);
  return { ok: true, inquiry: row };
}

export async function updateClientInquiryByAuthor(params: {
  inquiryId: string;
  authorUserId: string;
  title?: string;
  body?: string;
  imageUrls?: string[];
}): Promise<{ ok: true; inquiry: ClientInquiryStored } | { ok: false; error: string }> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, params.authorUserId.trim());
  const idx = store.clientInquiries.findIndex((x) => x.id === params.inquiryId.trim());
  if (idx < 0) return { ok: false, error: "문의를 찾을 수 없습니다." };
  const cur = store.clientInquiries[idx];
  if (resolveCanonicalUserId(store, cur.clientUserId) !== canonical) {
    return { ok: false, error: "권한이 없습니다." };
  }
  if (cur.status === "DONE") {
    return { ok: false, error: "처리 완료된 문의는 수정할 수 없습니다." };
  }
  const title = params.title !== undefined ? params.title.trim() : cur.title;
  const body = params.body !== undefined ? params.body.trim() : cur.body;
  if (!title) return { ok: false, error: "제목을 입력해 주세요." };
  if (!body) return { ok: false, error: "내용을 입력해 주세요." };
  if (title.length > 200) return { ok: false, error: "제목은 200자 이하로 입력해 주세요." };
  if (body.length > 20000) return { ok: false, error: "내용은 20000자 이하로 입력해 주세요." };
  let imageUrls = cur.imageUrls;
  if (params.imageUrls !== undefined) {
    imageUrls = normalizeInquiryImageUrls(params.imageUrls);
  }
  if (cur.type === "ERROR" && imageUrls.length === 0) {
    return { ok: false, error: "오류 제보는 이미지를 1장 이상 첨부해 주세요." };
  }
  const next: ClientInquiryStored = {
    ...cur,
    title,
    body,
    imageUrls,
    updatedAt: new Date().toISOString(),
  };
  store.clientInquiries[idx] = next;
  await writeStore(store);
  return { ok: true, inquiry: next };
}

export async function updateClientInquiryStatusByPlatform(params: {
  inquiryId: string;
  status: ClientInquiryStatus;
}): Promise<{ ok: true; inquiry: ClientInquiryStored } | { ok: false; error: string }> {
  const st = params.status;
  if (st !== "OPEN" && st !== "CHECKED" && st !== "DONE") {
    return { ok: false, error: "상태 값이 올바르지 않습니다." };
  }
  const store = await readStore();
  const idx = store.clientInquiries.findIndex((x) => x.id === params.inquiryId.trim());
  if (idx < 0) return { ok: false, error: "문의를 찾을 수 없습니다." };
  const cur = store.clientInquiries[idx];
  const next: ClientInquiryStored = {
    ...cur,
    status: st,
    updatedAt: new Date().toISOString(),
  };
  store.clientInquiries[idx] = next;
  await writeStore(store);
  return { ok: true, inquiry: next };
}

export async function upsertClientOrganizationForUser(
  userId: string,
  params: {
    name: string;
    shortDescription: string | null;
    description: string | null;
    fullDescription: string | null;
    logoImageUrl: string | null;
    coverImageUrl: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    addressDetail: string | null;
    addressJibun: string | null;
    zipCode: string | null;
    latitude: number | null;
    longitude: number | null;
    addressNaverMapEnabled: boolean;
    region: string | null;
    typeSpecificJson: string | null;
    isPublished: boolean;
    setupCompleted: boolean;
  }
): Promise<{ ok: true; org: ClientOrganizationStored } | { ok: false; error: string }> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());

  const now = new Date().toISOString();
  const idx = store.clientOrganizations.findIndex((o) => o.clientUserId === canonical);
  const existing = idx >= 0 ? store.clientOrganizations[idx] : null;

  const orgId = existing?.id ?? `client-org-${canonical}`;
  const slugResolved = resolveClientOrgSlug(existing, orgId);

  const dup = store.clientOrganizations.some(
    (o) => o.clientUserId !== canonical && o.slug === slugResolved
  );
  if (dup) {
    return { ok: false, error: "조직 식별자 충돌이 있습니다. 관리자에게 문의해 주세요." };
  }

  const nextType = existing?.type?.trim() ? existing.type.trim() : "VENUE";

  const next: ClientOrganizationStored = {
    clientUserId: canonical,
    id: orgId,
    slug: slugResolved,
    name: params.name.trim(),
    type: nextType,
    shortDescription: params.shortDescription,
    description: params.description,
    fullDescription: params.fullDescription,
    logoImageUrl: params.logoImageUrl,
    coverImageUrl: params.coverImageUrl,
    phone: params.phone,
    email: params.email,
    website: params.website,
    address: params.address,
    addressDetail: params.addressDetail,
    addressJibun: params.addressJibun,
    zipCode: params.zipCode,
    latitude: params.latitude,
    longitude: params.longitude,
    addressNaverMapEnabled: params.addressNaverMapEnabled,
    region: params.region,
    typeSpecificJson: params.typeSpecificJson,
    clientType: existing?.clientType === "REGISTERED" ? "REGISTERED" : "GENERAL",
    approvalStatus: existing?.approvalStatus ?? "APPROVED",
    status: existing?.status ?? "ACTIVE",
    adminRemarks: existing?.adminRemarks ?? null,
    membershipType: existing?.membershipType === "ANNUAL" ? "ANNUAL" : "NONE",
    membershipExpireAt: existing?.membershipExpireAt ?? null,
    isPublished: params.isPublished,
    setupCompleted: params.setupCompleted,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (idx >= 0) store.clientOrganizations[idx] = next;
  else store.clientOrganizations.push(next);

  await writeStore(store);
  return { ok: true, org: next };
}

export async function getClientVenueIntroByUserId(userId: string): Promise<ClientVenueIntroStored | null> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  return store.clientVenueIntros.find((o) => o.clientUserId === canonical) ?? null;
}

export async function upsertClientVenueIntroForUser(
  userId: string,
  params: {
    outlineDisplayMode: OutlineDisplayMode | null;
    outlineHtml: string | null;
    outlineImageUrl: string | null;
    outlinePdfUrl: string | null;
  }
): Promise<ClientVenueIntroStored> {
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, userId.trim());
  const now = new Date().toISOString();
  const idx = store.clientVenueIntros.findIndex((o) => o.clientUserId === canonical);
  const next: ClientVenueIntroStored = {
    clientUserId: canonical,
    outlineDisplayMode: params.outlineDisplayMode,
    outlineHtml: params.outlineHtml,
    outlineImageUrl: params.outlineImageUrl,
    outlinePdfUrl: params.outlinePdfUrl,
    updatedAt: now,
  };
  if (idx >= 0) store.clientVenueIntros[idx] = next;
  else store.clientVenueIntros.push(next);
  await writeStore(store);
  return next;
}

/** 사이트 당구장안내 목록(게시판형) — 카탈로그 + 연결된 사업장설정 org */
export type SiteVenueBoardRow = {
  venueId: string;
  name: string;
  region: string;
  catalogTypeLabel: string;
  venueCategory: "daedae_only" | "mixed";
  /** 목록·필터 호환(구버전) */
  feeCategory: "normal" | "flat" | null;
  /** 요금 유형(목록·필터·표시) */
  pricingType: VenuePricingType;
  introLine: string | null;
  thumbnailUrl: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

export async function getSiteVenuesBoardRows(): Promise<SiteVenueBoardRow[]> {
  const store = await readStore();
  const venueRows = store.clientOrganizations
    .filter((org) => org.type === "VENUE")
    .filter((org) => org.approvalStatus === "APPROVED")
    .filter((org) => org.status === "ACTIVE")
    .filter((org) => org.isPublished)
    .filter((org) => org.setupCompleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((org) => {
      const ts = parseTypeSpecific("VENUE", org.typeSpecificJson ?? null);
      const vs = ts as VenueSpecific;
      const reps = normalizeRepresentativeImageUrls(vs.representativeImageUrls);
      const cover = org.coverImageUrl?.trim() ?? "";
      const region = org.region?.trim() || "";
      const introLine = org.shortDescription?.trim() || org.description?.trim() || null;
      const venueCategory: "daedae_only" | "mixed" =
        vs.venueCategory === "mixed" ? "mixed" : "daedae_only";
      let feeCategory: "normal" | "flat" | null = null;
      const pricingType = resolveVenuePricingType(vs);
      if (pricingType === "GENERAL") feeCategory = "normal";
      else if (pricingType === "FLAT") feeCategory = "flat";
      else feeCategory = null;
      return {
        venueId: org.slug?.trim() || org.id,
        name: org.name?.trim() || "이름 없음",
        region,
        catalogTypeLabel: "당구장",
        venueCategory,
        feeCategory,
        pricingType,
        introLine,
        thumbnailUrl: reps[0] || cover || null,
        address: org.address?.trim() || null,
        phone: org.phone?.trim() || null,
        website: org.website?.trim() || null,
        lat: org.latitude,
        lng: org.longitude,
      };
    });
  if (venueRows.length > 0) return venueRows;
  return SITE_VENUES.map((venue) => ({
    venueId: venue.id,
    name: venue.name,
    region: venue.region,
    catalogTypeLabel: venue.type,
    venueCategory: "daedae_only" as const,
    feeCategory: null,
    pricingType: "GENERAL" as VenuePricingType,
    introLine: null,
    thumbnailUrl: null,
    address: null,
    phone: null,
    website: null,
    lat: venue.lat ?? null,
    lng: venue.lng ?? null,
  }));
}

/** 대회 장소 폼: 게시·설정 완료된 등록 당구장만 상호 부분일치 검색 */
export async function searchRegisteredVenuesForTournament(query: string): Promise<
  { venueId: string; name: string; addressLine: string; phone: string | null }[]
> {
  const store = await readStore();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = store.clientOrganizations
    .filter((org) => org.type === "VENUE")
    .filter((org) => org.approvalStatus === "APPROVED")
    .filter((org) => org.status === "ACTIVE")
    .filter((org) => org.isPublished)
    .filter((org) => org.setupCompleted)
    .filter((org) => (org.name?.trim().toLowerCase().includes(q) ?? false))
    .slice(0, 20)
    .map((org) => {
      const road = org.address?.trim() ?? "";
      const detail = org.addressDetail?.trim() ?? "";
      const addressLine = [road, detail].filter(Boolean).join(" ");
      return {
        venueId: org.slug?.trim() || org.id,
        name: org.name?.trim() || "이름 없음",
        addressLine,
        phone: org.phone?.trim() ? org.phone.trim() : null,
      };
    });
  return rows;
}

export type SiteVenueDetail = {
  venueId: string;
  name: string;
  /** 표시용 지역 (빈 값이면 상세에서 생략) */
  region: string | null;
  /** 도로명 주소 1줄 (상세 기본정보용, 상세주소·지번·우편번호 제외) */
  addressLine: string | null;
  /** 외부 링크 버튼용 */
  website: string | null;
  phone: string | null;
  /** typeSpecificJson.businessHours (사업장설정 영업시간) */
  businessHours: string | null;
  daedaeTableCount: string | null;
  jungdaeTableCount: string | null;
  pocketTableCount: string | null;
  /** 당구대 브랜드(종류), 있을 때만 상세에 (이름) 형태로 표시 */
  daedaeKind: string | null;
  jungdaeKind: string | null;
  pocketKind: string | null;
  daedaeFee: string | null;
  jungdaeFee: string | null;
  pocketFee: string | null;
  scoreSystem: string | null;
  galleryImageUrls: string[];
  shortDescription: string | null;
  description: string | null;
  introDisplayMode: OutlineDisplayMode | null;
  introHtml: string | null;
  introPdfUrl: string | null;
  /** 네이버 지도 검색 링크 (연동·주소 조건 충족 시) */
  naverMapUrl: string | null;
  pricingType: VenuePricingType;
  flatRateInfo: string | null;
};

export async function getSiteVenueDetailById(venueIdRaw: string): Promise<SiteVenueDetail | null> {
  const store = await readStore();
  const venueId = venueIdRaw.trim();
  if (!venueId) return null;
  const org =
    store.clientOrganizations.find(
      (x) =>
        x.type === "VENUE" &&
        x.approvalStatus === "APPROVED" &&
        x.status === "ACTIVE" &&
        x.isPublished &&
        x.setupCompleted &&
        (x.slug === venueId || x.id === venueId)
    ) ?? null;
  if (!org) {
    const catalog = SITE_VENUES.find((x) => x.id === venueId) ?? null;
    if (!catalog) return null;
    return {
      venueId: catalog.id,
      name: catalog.name,
      region: catalog.region?.trim() || null,
      addressLine: null,
      website: null,
      phone: null,
      daedaeTableCount: null,
      jungdaeTableCount: null,
      pocketTableCount: null,
      daedaeKind: null,
      jungdaeKind: null,
      pocketKind: null,
      daedaeFee: null,
      jungdaeFee: null,
      pocketFee: null,
      scoreSystem: null,
      galleryImageUrls: [],
      shortDescription: null,
      description: null,
      introDisplayMode: null,
      introHtml: null,
      introPdfUrl: null,
      naverMapUrl: null,
      pricingType: "GENERAL",
      flatRateInfo: null,
      businessHours: null,
    };
  }
  const intro = store.clientVenueIntros.find((x) => x.clientUserId === org.clientUserId) ?? null;
  const ts = parseTypeSpecific("VENUE", org.typeSpecificJson ?? null);
  const vs = ts as VenueSpecific;
  const reps = normalizeRepresentativeImageUrls(vs.representativeImageUrls);
  const trimOrNull = (s: string | undefined) => {
    const t = s?.trim() ?? "";
    return t.length ? t : null;
  };
  let galleryImageUrls = [...reps];
  if (
    galleryImageUrls.length === 0 &&
    intro?.outlineDisplayMode === "IMAGE" &&
    intro.outlineImageUrl?.trim()
  ) {
    galleryImageUrls = [intro.outlineImageUrl.trim()];
  }
  const road = org.address?.trim() ?? "";
  const detail = org.addressDetail?.trim() ?? "";
  const fullAddr = [road, detail].filter(Boolean).join(" ");
  const naverMapUrl =
    fullAddr && org.addressNaverMapEnabled === true
      ? `https://map.naver.com/v5/search/${encodeURIComponent(fullAddr)}`
      : null;
  const scoreRaw = typeof vs.scoreSystem === "string" ? vs.scoreSystem.trim() : "";
  const pricingType = resolveVenuePricingType(vs);
  const flatRaw = typeof vs.flatRateInfo === "string" ? vs.flatRateInfo.trim() : "";
  const web = org.website?.trim() ?? "";
  const hoursRaw = typeof vs.businessHours === "string" ? vs.businessHours.trim() : "";
  return {
    venueId: org.slug?.trim() || org.id,
    name: org.name?.trim() || "이름 없음",
    region: org.region?.trim() || null,
    addressLine: road.length ? road : null,
    website: web.length ? web : null,
    phone: org.phone?.trim() || null,
    businessHours: hoursRaw.length ? hoursRaw : null,
    daedaeTableCount: trimOrNull(vs.daedae?.count),
    jungdaeTableCount: trimOrNull(vs.jungdae?.count),
    pocketTableCount: trimOrNull(vs.pocket?.count),
    daedaeKind: trimOrNull(vs.daedae?.kind),
    jungdaeKind: trimOrNull(vs.jungdae?.kind),
    pocketKind: trimOrNull(vs.pocket?.kind),
    daedaeFee: trimOrNull(vs.daedae?.fee),
    jungdaeFee: trimOrNull(vs.jungdae?.fee),
    pocketFee: trimOrNull(vs.pocket?.fee),
    scoreSystem: scoreRaw.length ? scoreRaw : null,
    galleryImageUrls,
    shortDescription: org.shortDescription?.trim() || null,
    description: org.description?.trim() || null,
    introDisplayMode: intro?.outlineDisplayMode ?? null,
    introHtml: intro?.outlineHtml ?? null,
    introPdfUrl: intro?.outlinePdfUrl ?? null,
    naverMapUrl,
    pricingType,
    flatRateInfo: flatRaw.length ? flatRaw : null,
  };
}

export async function getApplicationSummaries(): Promise<
  Array<{
    application: ClientApplication;
    user: DevUser | null;
  }>
> {
  const store = await readStore();
  return store.clientApplications
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((application) => ({
      application,
      user: findUserByRawId(store, application.userId),
    }));
}

function finalizeTournamentDates(
  dateInput: string,
  eventDatesInput: string[] | null,
  rule: TournamentRuleSnapshot
): { ok: true; date: string; eventDates: string[] | null } | { ok: false; error: string } {
  const ymdOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  const dIn = dateInput.trim();
  if (!dIn) return { ok: false, error: "대회 날짜를 입력해 주세요." };
  if (!ymdOk(dIn)) return { ok: false, error: "대회 날짜 형식이 올바르지 않습니다." };

  if (rule.durationType === "1_DAY") {
    const one = eventDatesInput && eventDatesInput.length === 1 ? eventDatesInput[0]!.trim() : dIn;
    if (!ymdOk(one)) return { ok: false, error: "대회 날짜 형식이 올바르지 않습니다." };
    if (one !== dIn) return { ok: false, error: "시작 날짜와 일정이 일치하지 않습니다." };
    return { ok: true, date: dIn, eventDates: null };
  }

  const n = rule.durationDays ?? 0;
  if (n < 2 || n > 10) return { ok: false, error: "대회 기간(일 수)이 올바르지 않습니다." };
  const sorted = eventDatesInput ? [...eventDatesInput].map((x) => x.trim()).sort() : [];
  if (sorted.length !== n) {
    return { ok: false, error: `대회 일정을 ${n}일 모두 선택해 주세요.` };
  }
  for (const x of sorted) {
    if (!ymdOk(x)) return { ok: false, error: "대회 일정 날짜 형식이 올바르지 않습니다." };
  }
  if (sorted[0] !== dIn) {
    return { ok: false, error: "첫째 날은 시작 날짜와 같아야 합니다." };
  }
  return { ok: true, date: dIn, eventDates: sorted };
}

export async function createTournament(params: {
  title: string;
  date: string;
  location: string;
  maxParticipants: number;
  entryFee: number;
  createdBy: string;
  rule?: Partial<TournamentRuleSnapshot>;
  posterImageUrl?: string | null;
  statusBadge?: TournamentStatusBadge;
  summary?: string | null;
  prizeInfo?: string | null;
  outlineDisplayMode?: OutlineDisplayMode | null;
  outlineHtml?: string | null;
  outlineImageUrl?: string | null;
  outlinePdfUrl?: string | null;
  venueGuideVenueId?: string | null;
  eventDates?: unknown;
  extraVenues?: unknown;
}): Promise<{ ok: true; tournament: Tournament } | { ok: false; error: string }> {
  const title = params.title.trim();
  const location = params.location.trim();
  const maxParticipants = Number(params.maxParticipants);
  const entryFee = Number(params.entryFee);

  if (!title) return { ok: false, error: "대회명을 입력해 주세요." };
  if (!location) return { ok: false, error: "장소를 입력해 주세요." };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "모집 인원은 1명 이상이어야 합니다." };
  }
  if (!Number.isFinite(entryFee) || entryFee < 0) {
    return { ok: false, error: "참가비는 0 이상이어야 합니다." };
  }

  const rule = normalizeTournamentRule(params.rule);
  const validated = validateTournamentRuleForCreate(rule);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const eventDatesParsed = parseTournamentEventDates(params.eventDates);
  const datesFinal = finalizeTournamentDates(params.date, eventDatesParsed, rule);
  if (!datesFinal.ok) return { ok: false, error: datesFinal.error };
  const date = datesFinal.date;
  const eventDates = datesFinal.eventDates;

  const extraVenues = parseTournamentExtraVenues(params.extraVenues);

  const posterImageUrl =
    params.posterImageUrl != null && String(params.posterImageUrl).trim() !== ""
      ? String(params.posterImageUrl).trim()
      : null;
  const summary =
    params.summary != null && String(params.summary).trim() !== "" ? String(params.summary).trim() : null;
  const prizeInfo =
    params.prizeInfo != null && String(params.prizeInfo).trim() !== "" ? String(params.prizeInfo).trim() : null;

  const om = params.outlineDisplayMode;
  const outlineDisplayMode: OutlineDisplayMode | null =
    om === "TEXT" || om === "IMAGE" || om === "PDF" ? om : null;
  const outlineHtml =
    params.outlineHtml != null && String(params.outlineHtml) !== "" ? String(params.outlineHtml) : null;
  const outlineImageUrl =
    params.outlineImageUrl != null && String(params.outlineImageUrl).trim() !== ""
      ? String(params.outlineImageUrl).trim()
      : null;
  const outlinePdfUrl =
    params.outlinePdfUrl != null && String(params.outlinePdfUrl).trim() !== ""
      ? String(params.outlinePdfUrl).trim()
      : null;

  const store = await readStore();
  const venueGuideVenueId = resolveVenueGuideVenueIdFromStore(store, params.venueGuideVenueId);

  const tournament: Tournament = {
    id: randomUUID(),
    title,
    date,
    eventDates,
    location,
    extraVenues,
    maxParticipants: Math.floor(maxParticipants),
    entryFee: Math.floor(entryFee),
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    posterImageUrl,
    statusBadge: params.statusBadge != null ? normalizeTournamentStatusBadge(params.statusBadge) : "초안",
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule,
  };
  store.tournaments.push(tournament);
  await writeStore(store);
  return { ok: true, tournament: normalizeTournament(tournament, store) };
}

export async function listTournamentsByCreator(userId: string): Promise<Tournament[]> {
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, userId.trim());
  return store.tournaments
    .filter((item) => item.createdBy === canonicalUserId)
    .map((item) => normalizeTournament(item, store))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllTournaments(): Promise<Tournament[]> {
  const store = await readStore();
  return store.tournaments
    .slice()
    .map((item) => normalizeTournament(item, store))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 대회 `date` 필드를 YYYY-MM-DD로 통일(기간 필터, v2 startAt 대응) */
function tournamentDateToYmdForFilter(dateStr: string): string | null {
  const s = String(dateStr ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * v2 장부 라인만으로 대회별·전체 수입·지출·순이익 (조회 전용).
 * 게시된 대회(`tournamentPublishedCards` 중 isPublished·isActive)만 포함 — 대회일 기간 필터 없음.
 */
export async function getSettlementLedgerOverviewForClient(params: {
  userId: string;
  role: AuthRole;
}): Promise<
  | {
      ok: true;
      rows: { tournamentId: string; title: string; income: number; expense: number; net: number }[];
      grand: { income: number; expense: number; net: number };
    }
  | { ok: false; error: string }
> {
  const tournaments =
    params.role === "PLATFORM" ? await listAllTournaments() : await listTournamentsByCreator(params.userId);

  const store = await readStore();
  const published = tournaments.filter((t) =>
    store.tournamentPublishedCards.some(
      (c) => c.tournamentId === t.id && c.isPublished === true && c.isActive === true
    )
  );

  published.sort((a, b) => {
    const ay = tournamentDateToYmdForFilter(a.date) ?? "";
    const by = tournamentDateToYmdForFilter(b.date) ?? "";
    return by.localeCompare(ay);
  });

  const rows: { tournamentId: string; title: string; income: number; expense: number; net: number }[] = [];
  let gin = 0;
  let gex = 0;
  for (const t of published) {
    const s = store.settlements.find((item) => item.tournamentId === t.id);
    const lines = normalizeLedgerLinesArray(s?.ledgerLines);
    const { income, expense, net } = computeLedgerTotalsFromLines(lines);
    gin += income;
    gex += expense;
    rows.push({ tournamentId: t.id, title: t.title, income, expense, net });
  }

  return {
    ok: true,
    rows,
    grand: { income: gin, expense: gex, net: gin - gex },
  };
}

/** 메인·사이트에 게시 중인 대회 카드가 있을 때 true — 정산 허브·장부 노출 기준 */
export async function tournamentHasActivePublishedCard(tournamentId: string): Promise<boolean> {
  const store = await readStore();
  const id = tournamentId.trim();
  if (!id) return false;
  return store.tournamentPublishedCards.some(
    (c) => c.tournamentId === id && c.isPublished === true && c.isActive === true
  );
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  const store = await readStore();
  const tournament = store.tournaments.find((item) => item.id === tournamentId) ?? null;
  return tournament ? normalizeTournament(tournament, store) : null;
}

/** 동일 작성자 대회 제목 중 `이름 (n)` 패턴으로 다음 복제 제목 계산 */
export function computeDuplicateTournamentTitle(sourceTitle: string, existingTitles: string[]): string {
  const parseOne = (title: string): { base: string; suffix: number | null } => {
    const t = title.trim();
    const m = t.match(/^(.*) \((\d+)\)$/);
    if (m?.[1] != null && m[2] != null) {
      const n = Number(m[2]);
      return { base: m[1].trim(), suffix: Number.isFinite(n) ? n : null };
    }
    return { base: t, suffix: null };
  };
  const { base: sourceBase } = parseOne(sourceTitle);
  let max = 0;
  for (const t of existingTitles) {
    const p = parseOne(t);
    if (p.base !== sourceBase) continue;
    if (p.suffix === null) max = Math.max(max, 0);
    else max = Math.max(max, p.suffix);
  }
  return `${sourceBase} (${max + 1})`;
}

export async function assertClientCanManageTournament(params: {
  actorUserId: string;
  actorRole: AuthRole;
  tournamentId: string;
}): Promise<
  { ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus: 403 | 404 }
> {
  const tid = params.tournamentId.trim();
  if (!tid) return { ok: false, error: "잘못된 요청입니다.", httpStatus: 404 };
  const tournament = await getTournamentById(tid);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다.", httpStatus: 404 };
  if (params.actorRole === "PLATFORM") return { ok: true, tournament };
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, params.actorUserId.trim());
  if (tournament.createdBy !== canonical) {
    return { ok: false, error: "접근 권한이 없습니다.", httpStatus: 403 };
  }
  return { ok: true, tournament };
}

export async function updateTournament(params: {
  tournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
  title: string;
  date: string;
  location: string;
  maxParticipants: number;
  entryFee: number;
  rule?: Partial<TournamentRuleSnapshot>;
  posterImageUrl?: string | null;
  summary?: string | null;
  prizeInfo?: string | null;
  outlineDisplayMode?: OutlineDisplayMode | null;
  outlineHtml?: string | null;
  outlineImageUrl?: string | null;
  outlinePdfUrl?: string | null;
  venueGuideVenueId?: string | null;
  eventDates?: unknown;
  extraVenues?: unknown;
}): Promise<
  { ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus?: 403 | 404 }
> {
  const gate = await assertClientCanManageTournament({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.tournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const title = params.title.trim();
  const location = params.location.trim();
  const maxParticipants = Number(params.maxParticipants);
  const entryFee = Number(params.entryFee);

  if (!title) return { ok: false, error: "대회명을 입력해 주세요." };
  if (!location) return { ok: false, error: "장소를 입력해 주세요." };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "모집 인원은 1명 이상이어야 합니다." };
  }
  if (!Number.isFinite(entryFee) || entryFee < 0) {
    return { ok: false, error: "참가비는 0 이상이어야 합니다." };
  }

  const rule = normalizeTournamentRule(params.rule);
  const validated = validateTournamentRuleForCreate(rule);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const eventDatesParsed = parseTournamentEventDates(params.eventDates);
  const datesFinal = finalizeTournamentDates(params.date, eventDatesParsed, rule);
  if (!datesFinal.ok) return { ok: false, error: datesFinal.error };
  const date = datesFinal.date;
  const eventDates = datesFinal.eventDates;

  const extraVenues = parseTournamentExtraVenues(params.extraVenues);

  const posterImageUrl =
    params.posterImageUrl != null && String(params.posterImageUrl).trim() !== ""
      ? String(params.posterImageUrl).trim()
      : null;
  const summary =
    params.summary != null && String(params.summary).trim() !== "" ? String(params.summary).trim() : null;
  const prizeInfo =
    params.prizeInfo != null && String(params.prizeInfo).trim() !== "" ? String(params.prizeInfo).trim() : null;

  const outlineHtmlRaw = params.outlineHtml;
  const outlineHtmlCandidate = typeof outlineHtmlRaw === "string" ? outlineHtmlRaw : "";
  const outlineHtml =
    outlineHtmlCandidate !== "" && !isEmptyOutlineHtml(outlineHtmlCandidate) ? outlineHtmlCandidate : null;
  const outlineImageUrl =
    params.outlineImageUrl != null && String(params.outlineImageUrl).trim() !== ""
      ? String(params.outlineImageUrl).trim()
      : null;
  const outlinePdfUrl =
    params.outlinePdfUrl != null && String(params.outlinePdfUrl).trim() !== ""
      ? String(params.outlinePdfUrl).trim()
      : null;
  const outlineModeParsed = params.outlineDisplayMode;
  const hasAnyOutline = Boolean(outlineHtml || outlineImageUrl || outlinePdfUrl);
  const outlineDisplayMode: OutlineDisplayMode | null = hasAnyOutline
    ? outlineModeParsed === "TEXT" || outlineModeParsed === "IMAGE" || outlineModeParsed === "PDF"
      ? outlineModeParsed
      : "TEXT"
    : null;

  const store = await readStore();
  const venueGuideVenueId = resolveVenueGuideVenueIdFromStore(store, params.venueGuideVenueId);

  const idx = store.tournaments.findIndex((item) => item.id === params.tournamentId.trim());
  if (idx < 0) return { ok: false, error: "대회를 찾을 수 없습니다.", httpStatus: 404 };

  const existing = store.tournaments[idx]!;
  const updated: Tournament = {
    ...existing,
    title,
    date,
    eventDates,
    location,
    extraVenues,
    maxParticipants: Math.floor(maxParticipants),
    entryFee: Math.floor(entryFee),
    posterImageUrl,
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule,
  };
  store.tournaments[idx] = updated;
  await writeStore(store);
  return { ok: true, tournament: normalizeTournament(updated, store) };
}

export async function deleteTournament(params: {
  tournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
}): Promise<{ ok: true } | { ok: false; error: string; httpStatus?: 403 | 404 }> {
  const gate = await assertClientCanManageTournament({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.tournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const id = params.tournamentId.trim();
  const store = await readStore();
  store.tournaments = store.tournaments.filter((t) => t.id !== id);
  store.tournamentApplications = store.tournamentApplications.filter((a) => a.tournamentId !== id);
  store.bracketParticipantSnapshots = store.bracketParticipantSnapshots.filter((s) => s.tournamentId !== id);
  store.brackets = store.brackets.filter((b) => b.tournamentId !== id);
  store.settlements = store.settlements.filter((s) => s.tournamentId !== id);
  store.publishedCardSnapshots = store.publishedCardSnapshots.filter(
    (s) => !(s.tournamentId === id && s.snapshotSourceType === "TOURNAMENT_SNAPSHOT")
  );
  store.tournamentPublishedCards = store.tournamentPublishedCards.filter((c) => c.tournamentId !== id);
  store.notifications = store.notifications.filter((n) => n.relatedTournamentId !== id);
  await writeStore(store);
  return { ok: true };
}

export async function duplicateTournament(params: {
  sourceTournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
}): Promise<
  { ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus?: 403 | 404 }
> {
  const gate = await assertClientCanManageTournament({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.sourceTournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const source = gate.tournament;
  const store = await readStore();
  const titles = store.tournaments.filter((t) => t.createdBy === source.createdBy).map((t) => t.title);
  const newTitle = computeDuplicateTournamentTitle(source.title, titles);

  return createTournament({
    title: newTitle,
    date: source.date,
    location: source.location,
    maxParticipants: source.maxParticipants,
    entryFee: source.entryFee,
    createdBy: source.createdBy,
    rule: source.rule,
    posterImageUrl: source.posterImageUrl,
    statusBadge: source.statusBadge,
    summary: source.summary,
    prizeInfo: source.prizeInfo,
    outlineDisplayMode: source.outlineDisplayMode,
    outlineHtml: source.outlineHtml,
    outlineImageUrl: source.outlineImageUrl,
    outlinePdfUrl: source.outlinePdfUrl,
    venueGuideVenueId: source.venueGuideVenueId,
    eventDates: source.eventDates,
    extraVenues: source.extraVenues,
  });
}

export async function syncActiveTournamentCardSnapshotStatusBadge(tournamentId: string): Promise<void> {
  const id = tournamentId.trim();
  if (!id) return;
  const store = await readStore();
  const tournament = store.tournaments.find((t) => t.id === id);
  if (!tournament) return;
  const badge = String(normalizeTournamentStatusBadge(tournament.statusBadge));
  const showOnMain = tournamentStatusEligibleForMainSlide(badge);
  const now = new Date().toISOString();
  let changed = false;
  for (const c of store.tournamentPublishedCards) {
    if (c.tournamentId === id && c.isActive) {
      c.status = badge;
      c.showOnMainSlide = showOnMain;
      c.updatedAt = now;
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}

export async function patchTournamentStatusBadge(params: {
  tournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
  statusBadge: TournamentStatusBadge;
}): Promise<{ ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus?: 403 | 404 }> {
  const gate = await assertClientCanManageTournament({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.tournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const store = await readStore();
  const idx = store.tournaments.findIndex((t) => t.id === params.tournamentId.trim());
  if (idx < 0) return { ok: false, error: "대회를 찾을 수 없습니다.", httpStatus: 404 };

  store.tournaments[idx]!.statusBadge = normalizeTournamentStatusBadge(params.statusBadge);
  await writeStore(store);
  await syncActiveTournamentCardSnapshotStatusBadge(params.tournamentId.trim());
  return { ok: true, tournament: normalizeTournament(store.tournaments[idx]!, store) };
}

export type TournamentSettlementSummary = {
  tournamentId: string;
  approvedCount: number;
  entryFee: number;
  totalDepositAmount: number;
  totalRefundAmount: number;
  netRevenue: number;
  totalExpenseAmount: number;
  finalProfit: number;
  isSettled: boolean;
};

export type TournamentSettlementEntry = {
  applicationId: string;
  applicantName: string;
  phone: string;
  depositorName: string;
  status: TournamentApplicationStatus;
  approvedAt: string;
  isRefunded: boolean;
};

function normalizeExpenseItem(item: SettlementExpenseItem): SettlementExpenseItem {
  return {
    id: item.id,
    title: (item.title ?? "").trim(),
    amount: Number.isFinite(Number(item.amount)) ? Math.max(0, Math.floor(Number(item.amount))) : 0,
  };
}

function normalizeLedgerLineStored(raw: unknown): SettlementLedgerLineStored | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const category = typeof o.category === "string" ? o.category.trim() : "";
  const flow = o.flow === "INCOME" || o.flow === "EXPENSE" ? o.flow : "";
  const amountKrw = Number.isFinite(Number(o.amountKrw)) ? Math.max(0, Math.round(Number(o.amountKrw))) : 0;
  if (!id || !category || !flow) return null;
  const sortOrder = Number.isFinite(Number(o.sortOrder)) ? Math.floor(Number(o.sortOrder)) : 0;
  const ed =
    typeof o.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.entryDate.trim()) ? o.entryDate.trim() : null;
  return {
    id,
    category,
    flow,
    amountKrw,
    label: o.label != null && typeof o.label === "string" ? o.label : null,
    note: o.note != null && typeof o.note === "string" ? o.note : null,
    sortOrder,
    ...(ed ? { entryDate: ed } : {}),
  };
}

function normalizeLedgerLinesArray(raw: unknown): SettlementLedgerLineStored[] {
  if (!Array.isArray(raw)) return [];
  const out: SettlementLedgerLineStored[] = [];
  for (const row of raw) {
    const n = normalizeLedgerLineStored(row);
    if (n) out.push(n);
  }
  return out;
}

function getOrCreateSettlement(store: DevStore, tournamentId: string): TournamentSettlement {
  let settlement = store.settlements.find((item) => item.tournamentId === tournamentId);
  if (!settlement) {
    settlement = {
      tournamentId,
      refundedApplicationIds: [],
      expenseItems: [],
      ledgerLines: [],
      isSettled: false,
      updatedAt: new Date().toISOString(),
    };
    store.settlements.push(settlement);
  }
  settlement.refundedApplicationIds = Array.isArray(settlement.refundedApplicationIds)
    ? settlement.refundedApplicationIds
    : [];
  settlement.expenseItems = Array.isArray(settlement.expenseItems)
    ? settlement.expenseItems.map((item) => normalizeExpenseItem(item))
    : [];
  settlement.ledgerLines = normalizeLedgerLinesArray((settlement as TournamentSettlement).ledgerLines);
  settlement.isSettled = Boolean(settlement.isSettled);
  settlement.updatedAt = settlement.updatedAt || new Date().toISOString();
  return settlement;
}

export async function getTournamentSettlementByTournamentId(
  tournamentId: string
): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  await writeStore(store);
  return { ok: true, settlement };
}

export async function getSettlementSummaryByTournamentId(
  tournamentId: string
): Promise<{ ok: true; summary: TournamentSettlementSummary } | { ok: false; error: string }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  await writeStore(store);

  const approvedApplications = (await listTournamentApplicationsByTournamentId(tournamentId)).filter(
    (item) => item.status === "APPROVED"
  );
  const summary = computeLegacyAutoSettlementSummary({
    tournamentId,
    entryFee: tournament.entryFee,
    approvedApplicationIds: approvedApplications.map((item) => item.id),
    refundedApplicationIds: settlement.refundedApplicationIds,
    expenseAmounts: settlement.expenseItems.map((item) => item.amount),
    isSettled: settlement.isSettled,
  });

  return { ok: true, summary };
}

export async function listSettlementEntriesByTournamentId(
  tournamentId: string
): Promise<{ ok: true; entries: TournamentSettlementEntry[] } | { ok: false; error: string }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  await writeStore(store);

  const approvedEntries = (await listTournamentApplicationsByTournamentId(tournamentId))
    .filter((item) => item.status === "APPROVED")
    .map((item) => ({
      applicationId: item.id,
      applicantName: item.applicantName,
      phone: item.phone,
      depositorName: item.depositorName,
      status: item.status,
      approvedAt: item.statusChangedAt || item.updatedAt || item.createdAt,
      isRefunded: settlement.refundedApplicationIds.includes(item.id),
    }))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));

  return { ok: true, entries: approvedEntries };
}

export async function upsertSettlementExpenseItem(params: {
  tournamentId: string;
  expenseItemId?: string;
  title: string;
  amount: number;
  actorUserId?: string;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const title = params.title.trim();
  const amount = Number(params.amount);
  if (params.expenseItemId !== undefined && !params.expenseItemId.trim()) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!title) return { ok: false, error: "지출 항목명을 입력해 주세요." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "지출 금액은 0 이상이어야 합니다." };

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  const normalizedAmount = Math.floor(amount);
  const expenseItemId = params.expenseItemId?.trim() || null;
  let actionType = "EXPENSE_ADDED";
  let previousTitle = "";
  let previousAmount = 0;
  let changedExpenseItemId = "";
  if (!expenseItemId) {
    const newExpenseId = randomUUID();
    settlement.expenseItems.push({
      id: newExpenseId,
      title,
      amount: normalizedAmount,
    });
    changedExpenseItemId = newExpenseId;
  } else {
    const target = settlement.expenseItems.find((item) => item.id === expenseItemId);
    if (!target) return { ok: false, error: "수정할 지출 항목을 찾을 수 없습니다." };
    if (target.title === title && target.amount === normalizedAmount) {
      return { ok: false, error: "이미 처리된 상태입니다." };
    }
    actionType = "EXPENSE_UPDATED";
    previousTitle = target.title;
    previousAmount = target.amount;
    target.title = title;
    target.amount = normalizedAmount;
    changedExpenseItemId = expenseItemId;
  }

  settlement.updatedAt = new Date().toISOString();
  appendAuditLogSafe(store, {
    actorUserId: params.actorUserId,
    actionType,
    targetType: "settlement",
    targetId: tournamentId,
    meta: {
      tournamentId,
      expenseItemId: changedExpenseItemId,
      title,
      amount: normalizedAmount,
      previousTitle: previousTitle || undefined,
      previousAmount: actionType === "EXPENSE_UPDATED" ? previousAmount : undefined,
    },
  });
  await writeStore(store);
  return { ok: true, settlement };
}

export async function deleteSettlementExpenseItem(params: {
  tournamentId: string;
  expenseItemId: string;
  actorUserId?: string;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const expenseItemId = params.expenseItemId.trim();
  if (!expenseItemId) return { ok: false, error: "잘못된 요청입니다." };

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  const removed = settlement.expenseItems.find((item) => item.id === expenseItemId);
  const nextItems = settlement.expenseItems.filter((item) => item.id !== expenseItemId);
  if (nextItems.length === settlement.expenseItems.length) {
    return { ok: false, error: "삭제할 지출 항목을 찾을 수 없습니다." };
  }
  settlement.expenseItems = nextItems;
  settlement.updatedAt = new Date().toISOString();
  appendAuditLogSafe(store, {
    actorUserId: params.actorUserId,
    actionType: "EXPENSE_REMOVED",
    targetType: "settlement",
    targetId: tournamentId,
    meta: {
      tournamentId,
      expenseItemId,
      removedTitle: removed?.title,
      removedAmount: removed?.amount,
    },
  });
  await writeStore(store);
  return { ok: true, settlement };
}

export async function setSettlementRefunded(params: {
  tournamentId: string;
  applicationId: string;
  refunded: boolean;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  const applicationId = params.applicationId.trim();
  if (!applicationId) return { ok: false, error: "applicationId가 필요합니다." };

  const approvedEntriesResult = await listSettlementEntriesByTournamentId(params.tournamentId);
  if (!approvedEntriesResult.ok) return { ok: false, error: approvedEntriesResult.error };
  const isApprovedEntry = approvedEntriesResult.entries.some((item) => item.applicationId === applicationId);
  if (!isApprovedEntry) {
    return { ok: false, error: "APPROVED 참가자만 환불 처리할 수 있습니다." };
  }

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, params.tournamentId);
  if (params.refunded) {
    if (!settlement.refundedApplicationIds.includes(applicationId)) {
      settlement.refundedApplicationIds.push(applicationId);
    }
  } else {
    settlement.refundedApplicationIds = settlement.refundedApplicationIds.filter((id) => id !== applicationId);
  }
  settlement.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { ok: true, settlement };
}

export async function setTournamentSettlementStatus(params: {
  tournamentId: string;
  isSettled: boolean;
  actorUserId?: string;
}): Promise<{ ok: true; settlement: TournamentSettlement } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  if (typeof params.isSettled !== "boolean") return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  const previousIsSettled = settlement.isSettled;
  if (previousIsSettled === params.isSettled) {
    return { ok: false, error: "이미 처리된 상태입니다." };
  }
  settlement.isSettled = params.isSettled;
  settlement.updatedAt = new Date().toISOString();
  if (params.isSettled) {
    appendAuditLogSafe(store, {
      actorUserId: params.actorUserId,
      actionType: "SETTLEMENT_COMPLETED",
      targetType: "settlement",
      targetId: tournamentId,
      meta: {
        tournamentId,
        previousIsSettled,
        nextIsSettled: settlement.isSettled,
      },
    });
  }
  await writeStore(store);
  return { ok: true, settlement };
}

export async function getTournamentLedgerLinesForClient(
  tournamentId: string
): Promise<{ ok: true; tournament: Tournament; lines: SettlementLedgerLineStored[] } | { ok: false; error: string }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const store = await readStore();
  const s = store.settlements.find((item) => item.tournamentId === tournamentId);
  const lines = normalizeLedgerLinesArray(s?.ledgerLines).sort((a, b) => {
    const ad = a.entryDate ?? "";
    const bd = b.entryDate ?? "";
    if (ad !== bd) return bd.localeCompare(ad);
    return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  });
  return { ok: true, tournament, lines };
}

export async function replaceSettlementLedgerLines(params: {
  tournamentId: string;
  lines: Array<{
    category: string;
    flow: string;
    amountKrw: number;
    label?: string | null;
    note?: string | null;
    entryDate?: string | null;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const built: SettlementLedgerLineStored[] = [];
  for (let i = 0; i < params.lines.length; i++) {
    const row = params.lines[i]!;
    const cat = String(row.category ?? "").trim();
    const flow = String(row.flow ?? "").trim();
    if (!isSettlementCategoryV2(cat)) {
      return { ok: false, error: "알 수 없는 카테고리입니다." };
    }
    if (flow !== "INCOME" && flow !== "EXPENSE") {
      return { ok: false, error: "구분은 수입(INCOME) 또는 비용(EXPENSE)이어야 합니다." };
    }
    const amountKrw = Number(row.amountKrw);
    if (!Number.isFinite(amountKrw) || amountKrw < 0) {
      return { ok: false, error: "금액은 0 이상이어야 합니다." };
    }
    const entryDateRaw = row.entryDate != null && typeof row.entryDate === "string" ? row.entryDate.trim() : "";
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(entryDateRaw) ? entryDateRaw : null;
    built.push({
      id: randomUUID(),
      category: cat,
      flow,
      amountKrw: Math.round(amountKrw),
      label: row.label != null && String(row.label).trim() ? String(row.label).trim() : null,
      note: row.note != null && String(row.note).trim() ? String(row.note).trim() : null,
      sortOrder: i,
      entryDate,
    });
  }

  const store = await readStore();
  const settlement = getOrCreateSettlement(store, tournamentId);
  settlement.ledgerLines = built;
  settlement.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { ok: true };
}

export function buildProtectedProofImageUrl(imageId: string, variant: "original" | "w320" | "w640"): string {
  return `/api/proof-images/${encodeURIComponent(imageId)}?variant=${variant}`;
}

/** 대회 포스터 등 사이트 공개 페이지용 이미지 URL (인증 불필요) */
export function buildSitePublicImageUrl(imageId: string, variant: "original" | "w320" | "w640"): string {
  return `/api/site-images/${encodeURIComponent(imageId)}?variant=${variant}`;
}

/** 일정 표시: 연속이면 `시작 ~ 종료`, 아니면 쉼표 구분 */
const KO_WEEKDAY_LONG = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

/** `YYYY-MM-DD` 저장값 옆에 요일(일요일~토요일) — 파싱 실패 시 원문 유지 */
function appendKoreanWeekday(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return trimmed;
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return `${trimmed} ${KO_WEEKDAY_LONG[d.getDay()]}`;
}

export function formatTournamentScheduleLabel(tournament: Pick<Tournament, "date" | "eventDates">): string {
  const dates =
    tournament.eventDates && tournament.eventDates.length > 0
      ? [...tournament.eventDates]
      : tournament.date
        ? [tournament.date]
        : [];
  const sorted = dates.map((d) => d.trim()).filter(Boolean).sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return appendKoreanWeekday(sorted[0]!);
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]! + "T12:00:00");
    const b = new Date(sorted[i]! + "T12:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || (b.getTime() - a.getTime()) / 86400000 !== 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) {
    return `${appendKoreanWeekday(sorted[0]!)} ~ ${appendKoreanWeekday(sorted[sorted.length - 1]!)}`;
  }
  return sorted.map(appendKoreanWeekday).join(", ");
}

/** 저장값이 과거 `/api/proof-images/...`(보호)인 경우 사이트 공개 엔드포인트로 바꿔 img src에 사용 */
export function resolveSitePosterDisplayUrl(posterUrl: string | null | undefined): string | null {
  if (typeof posterUrl !== "string") return null;
  const trimmed = posterUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/proof-images/")) {
    return trimmed.replace("/api/proof-images/", "/api/site-images/");
  }
  return trimmed;
}

export function extractProofImageIdFromPosterUrl(url: string): string | null {
  const trimmed = url.trim();
  const fromProof = trimmed.match(/\/api\/proof-images\/([^/?]+)/);
  if (fromProof?.[1]) return fromProof[1];
  const fromSite = trimmed.match(/\/api\/site-images\/([^/?]+)/);
  if (fromSite?.[1]) return fromSite[1];
  return null;
}

/** 대회 포스터 등 사이트에서 비로그인으로 열람 가능한 이미지인지 (메타 또는 대회 posterImageUrl 기준) */
export async function isSiteImagePubliclyAccessible(imageId: string): Promise<boolean> {
  const normalized = imageId.trim();
  if (!normalized) return false;
  const store = await readStore();
  const asset = store.proofImages.find((item) => item.id === normalized);
  if (!asset) return false;
  if (asset.sitePublic === true) return true;
  return store.tournaments.some((t) => {
    const poster = t.posterImageUrl;
    if (typeof poster !== "string" || !poster.trim()) return false;
    return extractProofImageIdFromPosterUrl(poster) === normalized;
  });
}

export async function createProofImageAsset(params: {
  imageId: string;
  uploaderUserId: string;
  originalExt: "jpg" | "png" | "webp";
  sitePublic?: boolean;
}): Promise<{ ok: true; asset: ProofImageAsset } | { ok: false; error: string }> {
  const imageId = params.imageId.trim();
  const uploaderUserId = params.uploaderUserId.trim();
  if (!imageId || !uploaderUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const store = await readStore();
  const user = findUserByRawId(store, uploaderUserId);
  if (!user) {
    return { ok: false, error: "사용자를 찾을 수 없습니다." };
  }
  const duplicated = store.proofImages.find((item) => item.id === imageId);
  if (duplicated) {
    if (params.sitePublic && !duplicated.sitePublic) {
      duplicated.sitePublic = true;
      await writeStore(store);
    }
    return { ok: true, asset: duplicated };
  }

  const asset: ProofImageAsset = {
    id: imageId,
    uploaderUserId: user.id,
    originalExt: params.originalExt,
    createdAt: new Date().toISOString(),
    ...(params.sitePublic ? { sitePublic: true } : {}),
  };
  store.proofImages.push(asset);
  await writeStore(store);
  return { ok: true, asset };
}

export async function getProofImageAssetById(imageId: string): Promise<ProofImageAsset | null> {
  const normalized = imageId.trim();
  if (!normalized) return null;
  const store = await readStore();
  return store.proofImages.find((item) => item.id === normalized) ?? null;
}

export function buildOutlinePdfPublicUrl(pdfId: string): string {
  const id = pdfId.trim();
  return `/api/client/outline-pdf/${encodeURIComponent(id)}`;
}

/** 저장된 공개 URL(`/api/client/outline-pdf/{id}`)에서 자산 id 추출 */
export function outlinePdfIdFromPublicUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  try {
    const pathPart = u.startsWith("http://") || u.startsWith("https://") ? new URL(u).pathname : u;
    const m = pathPart.match(/\/api\/client\/outline-pdf\/([^/?]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function outlineFileKindFromAsset(asset: OutlinePdfAsset | null): "pdf" | "docx" {
  return asset?.fileKind === "docx" ? "docx" : "pdf";
}

export async function createOutlinePdfAsset(params: {
  pdfId: string;
  uploaderUserId: string;
  fileKind: "pdf" | "docx";
}): Promise<{ ok: true; asset: OutlinePdfAsset } | { ok: false; error: string }> {
  const pdfId = params.pdfId.trim();
  const uploaderUserId = params.uploaderUserId.trim();
  if (!pdfId || !uploaderUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const store = await readStore();
  const user = findUserByRawId(store, uploaderUserId);
  if (!user) {
    return { ok: false, error: "사용자를 찾을 수 없습니다." };
  }
  const duplicated = store.outlinePdfAssets.find((item) => item.id === pdfId);
  if (duplicated) {
    return { ok: true, asset: duplicated };
  }

  const asset: OutlinePdfAsset = {
    id: pdfId,
    uploaderUserId: user.id,
    createdAt: new Date().toISOString(),
    fileKind: params.fileKind,
  };
  store.outlinePdfAssets.push(asset);
  await writeStore(store);
  return { ok: true, asset };
}

export async function getOutlinePdfAssetById(pdfId: string): Promise<OutlinePdfAsset | null> {
  const normalized = pdfId.trim();
  if (!normalized) return null;
  const store = await readStore();
  return store.outlinePdfAssets.find((item) => item.id === normalized) ?? null;
}

export async function canUserAccessOutlinePdfAsset(params: {
  userId: string;
  userRole: AuthRole;
  pdfId: string;
}): Promise<boolean> {
  const id = params.pdfId.trim();
  if (!id) return false;
  const store = await readStore();
  const canonical = resolveCanonicalUserId(store, params.userId.trim());
  if (params.userRole === "PLATFORM") return true;
  const asset = store.outlinePdfAssets.find((a) => a.id === id);
  if (!asset) return false;
  if (asset.uploaderUserId === canonical) return true;
  const url = buildOutlinePdfPublicUrl(asset.id);
  return store.tournaments.some((t) => t.createdBy === canonical && t.outlinePdfUrl === url);
}

/** 대회 데이터에 해당 PDF URL이 연결된 경우(사이트에서 요강 열람) */
export async function isOutlinePdfLinkedToAnyTournament(pdfId: string): Promise<boolean> {
  const id = pdfId.trim();
  if (!id) return false;
  const store = await readStore();
  const url = buildOutlinePdfPublicUrl(id);
  return store.tournaments.some((t) => t.outlinePdfUrl === url);
}

/** 비로그인 열람: 대회 요강 또는 게시된 당구장 소개에 연결된 문서 */
export async function isOutlinePdfLinkedForPublicSite(pdfId: string): Promise<boolean> {
  const id = pdfId.trim();
  if (!id) return false;
  if (await isOutlinePdfLinkedToAnyTournament(id)) return true;
  const store = await readStore();
  const url = buildOutlinePdfPublicUrl(id);
  for (const intro of store.clientVenueIntros) {
    if (intro.outlinePdfUrl !== url) continue;
    const org = store.clientOrganizations.find(
      (o) =>
        o.clientUserId === intro.clientUserId &&
        o.type === "VENUE" &&
        o.approvalStatus === "APPROVED" &&
        o.status === "ACTIVE" &&
        o.isPublished === true
    );
    if (org) return true;
  }
  return false;
}

export async function getTournamentApplicationByProofImageId(imageId: string): Promise<TournamentApplication | null> {
  const normalized = imageId.trim();
  if (!normalized) return null;
  const store = await readStore();
  const item = store.tournamentApplications.find((application) => application.proofImageId === normalized) ?? null;
  if (!item) return null;
  const createdAt = item.createdAt || new Date().toISOString();
  return {
    ...item,
    status: item.status || "APPLIED",
    proofImageId: item.proofImageId || "",
    proofImage320Url: item.proofImage320Url || "",
    proofImage640Url: item.proofImage640Url || "",
    proofOriginalUrl: item.proofOriginalUrl || "",
    ocrStatus: item.ocrStatus || "NOT_REQUESTED",
    ocrText: item.ocrText || "",
    ocrRawResult: item.ocrRawResult || "",
    ocrRequestedAt: item.ocrRequestedAt || null,
    ocrCompletedAt: item.ocrCompletedAt || null,
    updatedAt: item.updatedAt || createdAt,
    statusChangedAt: item.statusChangedAt || item.updatedAt || createdAt,
  };
}

export async function createTournamentApplication(params: {
  tournamentId: string;
  userId: string;
  applicantName: string;
  phone: string;
  depositorName: string;
  proofImageId: string;
  proofImage320Url: string;
  proofImage640Url: string;
  proofOriginalUrl: string;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  const applicantName = params.applicantName.trim();
  const phone = params.phone.trim();
  const depositorName = params.depositorName.trim();
  const proofImageId = params.proofImageId.trim();

  if (!applicantName) return { ok: false, error: "이름을 입력해 주세요." };
  if (!phone) return { ok: false, error: "전화번호를 입력해 주세요." };
  if (!depositorName) return { ok: false, error: "입금자명을 입력해 주세요." };
  if (!proofImageId) {
    return { ok: false, error: "증빙 이미지를 업로드해 주세요." };
  }

  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, params.userId.trim());
  const tournament = store.tournaments.find((item) => item.id === params.tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const duplicated = store.tournamentApplications.some(
    (item) => item.tournamentId === params.tournamentId && item.userId === canonicalUserId
  );
  if (duplicated) {
    return { ok: false, error: "이미 신청한 대회입니다." };
  }

  const proofImage = store.proofImages.find((item) => item.id === proofImageId);
  if (!proofImage) {
    return { ok: false, error: "증빙 이미지를 다시 업로드해 주세요." };
  }
  if (proofImage.uploaderUserId !== canonicalUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const now = new Date().toISOString();
  const application: TournamentApplication = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    userId: canonicalUserId,
    applicantName,
    phone,
    depositorName,
    proofImageId,
    proofImage320Url: buildProtectedProofImageUrl(proofImageId, "w320"),
    proofImage640Url: buildProtectedProofImageUrl(proofImageId, "w640"),
    proofOriginalUrl: buildProtectedProofImageUrl(proofImageId, "original"),
    ocrStatus: "NOT_REQUESTED",
    ocrText: "",
    ocrRawResult: "",
    ocrRequestedAt: null,
    ocrCompletedAt: null,
    status: "APPLIED",
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
  };

  store.tournamentApplications.push(application);
  await writeStore(store);
  return { ok: true, application };
}

export async function listTournamentApplicationsByTournamentId(
  tournamentId: string
): Promise<TournamentApplication[]> {
  const store = await readStore();
  return store.tournamentApplications
    .filter((item) => item.tournamentId === tournamentId)
    .map((item) => {
      const createdAt = item.createdAt || new Date().toISOString();
      return {
        ...item,
        status: item.status || "APPLIED",
        proofImageId: item.proofImageId || "",
        proofImage320Url: item.proofImage320Url || "",
        proofImage640Url: item.proofImage640Url || "",
        proofOriginalUrl: item.proofOriginalUrl || "",
        ocrStatus: item.ocrStatus || "NOT_REQUESTED",
        ocrText: item.ocrText || "",
        ocrRawResult: item.ocrRawResult || "",
        ocrRequestedAt: item.ocrRequestedAt || null,
        ocrCompletedAt: item.ocrCompletedAt || null,
        updatedAt: item.updatedAt || createdAt,
        statusChangedAt: item.statusChangedAt || item.updatedAt || createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listTournamentApplicationsByUserId(userId: string): Promise<TournamentApplication[]> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return [];
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, normalizedUserId);
  return store.tournamentApplications
    .filter((item) => item.userId === canonicalUserId)
    .map((item) => {
      const createdAt = item.createdAt || new Date().toISOString();
      return {
        ...item,
        status: item.status || "APPLIED",
        proofImageId: item.proofImageId || "",
        proofImage320Url: item.proofImage320Url || "",
        proofImage640Url: item.proofImage640Url || "",
        proofOriginalUrl: item.proofOriginalUrl || "",
        ocrStatus: item.ocrStatus || "NOT_REQUESTED",
        ocrText: item.ocrText || "",
        ocrRawResult: item.ocrRawResult || "",
        ocrRequestedAt: item.ocrRequestedAt || null,
        ocrCompletedAt: item.ocrCompletedAt || null,
        updatedAt: item.updatedAt || createdAt,
        statusChangedAt: item.statusChangedAt || item.updatedAt || createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 클라이언트 소유 대회 신청을 userId 기준 1인 1행으로 묶을 때 표시용 행 */
export type DeduplicatedApplicantRow = {
  userId: string;
  applicantName: string;
  phone: string;
  /** 가장 최근 신청 건의 createdAt (없으면 빈 문자열) */
  lastAppliedAt: string;
  /** 마케팅 푸시 동의. 명시적 false만 비동의로 간주( filterUserIdsWithMarketingPushConsent 와 동일 선호) */
  pushMarketingAgreed: boolean;
};

/**
 * 운영자(본인 생성 대회 또는 플랫폼 전체)에 신청된 참가자를 userId 기준으로 중복 제거한다.
 * 동일 userId에 여러 신청이 있으면 createdAt이 가장 최근인 신청의 이름·전화번호를 쓴다.
 */
export async function listDeduplicatedApplicantsForClientOwner(params: {
  ownerUserId: string;
  scope: "creator" | "platform";
}): Promise<DeduplicatedApplicantRow[]> {
  const store = await readStore();
  const ownerUserId = resolveCanonicalUserId(store, params.ownerUserId.trim());
  const tournamentIdSet = new Set<string>();
  for (const t of store.tournaments) {
    if (params.scope === "platform") {
      tournamentIdSet.add(t.id);
    } else if (t.createdBy === ownerUserId) {
      tournamentIdSet.add(t.id);
    }
  }
  const relevant = store.tournamentApplications.filter((a) => tournamentIdSet.has(a.tournamentId));
  const bestByUser = new Map<string, TournamentApplication>();
  for (const raw of relevant) {
    const uid = typeof raw.userId === "string" ? raw.userId.trim() : "";
    if (!uid) continue;
    const prev = bestByUser.get(uid);
    const ca = raw.createdAt || "";
    if (!prev) {
      bestByUser.set(uid, raw);
      continue;
    }
    const pb = prev.createdAt || "";
    if (ca.localeCompare(pb) > 0) bestByUser.set(uid, raw);
  }
  const rows: DeduplicatedApplicantRow[] = [];
  for (const app of bestByUser.values()) {
    const name = typeof app.applicantName === "string" ? app.applicantName.trim() : "";
    const phone = typeof app.phone === "string" ? app.phone.trim() : "";
    const uidTrim = app.userId.trim();
    const canonicalId = resolveCanonicalUserId(store, uidTrim);
    const u = findUserByRawId(store, canonicalId);
    const pushMarketingAgreed = u ? u.pushMarketingAgreed !== false : true;
    rows.push({
      userId: uidTrim,
      applicantName: name || "—",
      phone: phone || "—",
      lastAppliedAt: typeof app.createdAt === "string" ? app.createdAt : "",
      pushMarketingAgreed,
    });
  }
  rows.sort((a, b) => a.applicantName.localeCompare(b.applicantName, "ko"));
  return rows;
}

/** 마케팅 푸시 동의자만 남김. pushMarketingAgreed가 명시적으로 false인 경우만 제외(없음·true는 동의). */
export function filterUserIdsWithMarketingPushConsentInStore(store: DevStore, userIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of userIds) {
    const cid = resolveCanonicalUserId(store, String(raw).trim());
    if (!cid || seen.has(cid)) continue;
    const u = findUserByRawId(store, cid);
    if (!u) continue;
    if (u.pushMarketingAgreed === false) continue;
    seen.add(cid);
    out.push(cid);
  }
  return out;
}

export async function filterUserIdsWithMarketingPushConsent(userIds: string[]): Promise<string[]> {
  const store = await readStore();
  return filterUserIdsWithMarketingPushConsentInStore(store, userIds);
}

/**
 * 재안내용: 선택된 userId마다 사이트 마이페이지 알림(UserNotification) 1건씩 저장한다.
 */
export async function createReannounceNotifications(params: {
  targetUserIds: string[];
  title: string;
  message: string;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const title = params.title.trim();
  const message = params.message.trim();
  if (!title) return { ok: false, error: "제목을 입력해 주세요." };
  if (!message) return { ok: false, error: "내용을 입력해 주세요." };
  if (title.length > 120) return { ok: false, error: "제목은 120자 이하로 입력해 주세요." };
  if (message.length > 2000) return { ok: false, error: "내용은 2000자 이하로 입력해 주세요." };
  const rawIds = [...new Set(params.targetUserIds.map((id) => String(id).trim()).filter(Boolean))];
  if (rawIds.length === 0) return { ok: false, error: "수신자를 선택해 주세요." };

  const store = await readStore();
  const userIdSet = new Set(store.users.map((u) => u.id));
  for (const id of rawIds) {
    const canonicalUserId = resolveCanonicalUserId(store, id);
    if (!userIdSet.has(canonicalUserId)) {
      return { ok: false, error: "존재하지 않는 수신자가 포함되었습니다." };
    }
  }
  const consentIds = filterUserIdsWithMarketingPushConsentInStore(store, rawIds);
  if (consentIds.length === 0) {
    return { ok: false, error: "마케팅 푸시 수신에 동의한 수신자가 없습니다." };
  }
  const now = new Date().toISOString();
  let count = 0;
  for (const canonicalUserId of consentIds) {
    store.notifications.push({
      id: randomUUID(),
      userId: canonicalUserId,
      title,
      message,
      relatedTournamentId: null,
      createdAt: now,
      isRead: false,
    });
    count += 1;
  }
  await writeStore(store);
  return { ok: true, count };
}

export async function upsertWebPushSubscriptionForUser(params: {
  userId: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  };
}): Promise<WebPushSubscriptionRecord> {
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, params.userId);
  const endpoint = params.subscription.endpoint.trim();
  const p256dh = params.subscription.keys.p256dh.trim();
  const auth = params.subscription.keys.auth.trim();
  const exp = params.subscription.expirationTime;
  const expirationTime =
    exp === null || exp === undefined ? null : Number.isFinite(Number(exp)) ? Number(exp) : null;
  const now = new Date().toISOString();

  const idx = store.webPushSubscriptions.findIndex((s) => s.endpoint === endpoint);
  if (idx >= 0) {
    const row = store.webPushSubscriptions[idx];
    row.userId = canonicalUserId;
    row.keys = { p256dh, auth };
    row.expirationTime = expirationTime;
    row.updatedAt = now;
    await writeStore(store);
    return row;
  }

  const row: WebPushSubscriptionRecord = {
    id: randomUUID(),
    userId: canonicalUserId,
    endpoint,
    keys: { p256dh, auth },
    expirationTime,
    createdAt: now,
    updatedAt: now,
  };
  store.webPushSubscriptions.push(row);
  await writeStore(store);
  return row;
}

export async function upsertFcmDeviceTokenForUser(params: {
  userId: string;
  token: string;
  platform?: string | null;
}): Promise<FcmDeviceTokenRecord> {
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, params.userId);
  const token = params.token.trim();
  if (!token) {
    throw new Error("FCM token is empty");
  }
  const platform =
    params.platform === undefined || params.platform === null
      ? null
      : typeof params.platform === "string" && params.platform.trim()
        ? params.platform.trim()
        : null;
  const now = new Date().toISOString();
  const idx = store.fcmDeviceTokens.findIndex((row) => row.token === token);
  if (idx >= 0) {
    const row = store.fcmDeviceTokens[idx];
    row.userId = canonicalUserId;
    row.platform = platform;
    row.updatedAt = now;
    await writeStore(store);
    return row;
  }
  const row: FcmDeviceTokenRecord = {
    id: randomUUID(),
    userId: canonicalUserId,
    token,
    platform,
    createdAt: now,
    updatedAt: now,
  };
  store.fcmDeviceTokens.push(row);
  await writeStore(store);
  return row;
}

export async function listFcmDeviceTokensByUserId(userId: string): Promise<FcmDeviceTokenRecord[]> {
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, userId);
  return store.fcmDeviceTokens.filter((row) => row.userId === canonicalUserId);
}

/** 여러 userId에 등록된 FCM 토큰 전부(한 사용자·여러 기기). token 문자열 기준 중복 제거. */
export async function listFcmDeviceTokensForUserIds(userIds: string[]): Promise<FcmDeviceTokenRecord[]> {
  const store = await readStore();
  const idSet = new Set(
    userIds.map((id) => resolveCanonicalUserId(store, String(id).trim())).filter(Boolean)
  );
  const seenToken = new Set<string>();
  const out: FcmDeviceTokenRecord[] = [];
  for (const row of store.fcmDeviceTokens) {
    if (!idSet.has(row.userId)) continue;
    if (seenToken.has(row.token)) continue;
    seenToken.add(row.token);
    out.push(row);
  }
  return out;
}

/** 발송 실패한 무효 토큰 제거(간단 처리). 제거된 행 수 반환. */
export async function removeFcmDeviceTokensByTokenValues(tokens: string[]): Promise<number> {
  const raw = tokens.map((t) => String(t).trim()).filter(Boolean);
  if (raw.length === 0) return 0;
  const store = await readStore();
  const drop = new Set(raw);
  const before = store.fcmDeviceTokens.length;
  store.fcmDeviceTokens = store.fcmDeviceTokens.filter((row) => !drop.has(row.token));
  const removed = before - store.fcmDeviceTokens.length;
  if (removed > 0) {
    await writeStore(store);
  }
  return removed;
}

/** 플랫폼 푸시: 전체 회원 또는 CLIENT 역할만 */
export async function listUserIdsForPlatformPushAudience(audience: "all" | "client"): Promise<string[]> {
  const store = await readStore();
  if (audience === "client") {
    return store.users.filter((u) => u.role === "CLIENT").map((u) => resolveCanonicalUserId(store, u.id));
  }
  return store.users.map((u) => resolveCanonicalUserId(store, u.id));
}

export async function getTournamentApplicationById(
  tournamentId: string,
  entryId: string
): Promise<TournamentApplication | null> {
  const store = await readStore();
  const item =
    store.tournamentApplications.find((application) => application.tournamentId === tournamentId && application.id === entryId) ??
    null;
  if (!item) return null;
  const createdAt = item.createdAt || new Date().toISOString();
  return {
    ...item,
    status: item.status || "APPLIED",
    proofImageId: item.proofImageId || "",
    proofImage320Url: item.proofImage320Url || "",
    proofImage640Url: item.proofImage640Url || "",
    proofOriginalUrl: item.proofOriginalUrl || "",
    ocrStatus: item.ocrStatus || "NOT_REQUESTED",
    ocrText: item.ocrText || "",
    ocrRawResult: item.ocrRawResult || "",
    ocrRequestedAt: item.ocrRequestedAt || null,
    ocrCompletedAt: item.ocrCompletedAt || null,
    updatedAt: item.updatedAt || createdAt,
    statusChangedAt: item.statusChangedAt || item.updatedAt || createdAt,
  };
}

export async function listApprovedParticipantsByTournamentId(
  tournamentId: string
): Promise<TournamentApplication[]> {
  const applications = await listTournamentApplicationsByTournamentId(tournamentId);
  return applications.filter((item) => item.status === "APPROVED");
}

export async function createBracketParticipantSnapshot(params: {
  tournamentId: string;
}): Promise<{ ok: true; snapshot: BracketParticipantSnapshot } | { ok: false; error: string }> {
  const approvedParticipants = await listApprovedParticipantsByTournamentId(params.tournamentId);
  if (approvedParticipants.length === 0) {
    return { ok: false, error: "APPROVED 참가자가 없어 스냅샷을 생성할 수 없습니다." };
  }

  const store = await readStore();
  const existsTournament = store.tournaments.some((item) => item.id === params.tournamentId);
  if (!existsTournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const snapshot: BracketParticipantSnapshot = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    participants: approvedParticipants.map((item) => ({
      userId: item.userId,
      applicantName: item.applicantName,
      phone: item.phone,
    })),
    createdAt: new Date().toISOString(),
  };

  store.bracketParticipantSnapshots.push(snapshot);
  await writeStore(store);
  return { ok: true, snapshot };
}

export async function listBracketParticipantSnapshotsByTournamentId(
  tournamentId: string
): Promise<BracketParticipantSnapshot[]> {
  const store = await readStore();
  return store.bracketParticipantSnapshots
    .filter((item) => item.tournamentId === tournamentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLatestBracketParticipantSnapshotByTournamentId(
  tournamentId: string
): Promise<BracketParticipantSnapshot | null> {
  const snapshots = await listBracketParticipantSnapshotsByTournamentId(tournamentId);
  return snapshots[0] ?? null;
}

export async function createBracketFromSnapshot(
  snapshotId: string
): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  const store = await readStore();
  const snapshot = store.bracketParticipantSnapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    return { ok: false, error: "대상자 스냅샷을 찾을 수 없습니다." };
  }

  const pairCount = Math.floor(snapshot.participants.length / 2);
  if (pairCount === 0) {
    return { ok: false, error: "브래킷 생성을 위해 최소 2명의 참가자가 필요합니다." };
  }

  const matches: BracketMatch[] = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const p1 = snapshot.participants[i];
    const p2 = snapshot.participants[i + 1];
    matches.push({
      id: randomUUID(),
      player1: { userId: p1.userId, name: p1.applicantName },
      player2: { userId: p2.userId, name: p2.applicantName },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }

  const bracket: Bracket = {
    id: randomUUID(),
    tournamentId: snapshot.tournamentId,
    snapshotId: snapshot.id,
    rounds: [
      {
        roundNumber: 1,
        matches,
        status: "PENDING",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  store.brackets.push(bracket);
  await writeStore(store);
  return { ok: true, bracket };
}

export async function createBracketFromDraft(params: {
  tournamentId: string;
  snapshotId: string;
  matches: BracketDraftMatchInput[];
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  const store = await readStore();
  const snapshot = store.bracketParticipantSnapshots.find(
    (item) => item.id === params.snapshotId && item.tournamentId === params.tournamentId
  );
  if (!snapshot) {
    return { ok: false, error: "유효한 대진표 대상자 스냅샷을 찾을 수 없습니다." };
  }
  if (!Array.isArray(params.matches) || params.matches.length === 0) {
    return { ok: false, error: "확정 저장할 매치가 없습니다." };
  }

  const snapshotParticipants = new Map(snapshot.participants.map((participant) => [participant.userId, participant]));
  const assignedUserIds = new Set<string>();
  const normalizedMatches: BracketMatch[] = [];

  for (const draftMatch of params.matches) {
    const p1Id = draftMatch.player1?.userId?.trim() ?? "";
    const p2Id = draftMatch.player2?.userId?.trim() ?? "";
    if (!p1Id || !p2Id || p1Id === p2Id) {
      return { ok: false, error: "매치 참가자 정보가 올바르지 않습니다." };
    }
    if (assignedUserIds.has(p1Id) || assignedUserIds.has(p2Id)) {
      return { ok: false, error: "같은 참가자가 중복 배정되었습니다." };
    }

    const p1Snapshot = snapshotParticipants.get(p1Id);
    const p2Snapshot = snapshotParticipants.get(p2Id);
    if (!p1Snapshot || !p2Snapshot) {
      return { ok: false, error: "스냅샷에 없는 참가자가 포함되어 있습니다." };
    }

    assignedUserIds.add(p1Id);
    assignedUserIds.add(p2Id);
    normalizedMatches.push({
      id: randomUUID(),
      player1: { userId: p1Snapshot.userId, name: p1Snapshot.applicantName },
      player2: { userId: p2Snapshot.userId, name: p2Snapshot.applicantName },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }

  const bracket: Bracket = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    snapshotId: snapshot.id,
    rounds: [
      {
        roundNumber: 1,
        matches: normalizedMatches,
        status: "PENDING",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  store.brackets.push(bracket);
  await writeStore(store);
  return { ok: true, bracket };
}

export async function listBracketsByTournamentId(tournamentId: string): Promise<Bracket[]> {
  const store = await readStore();
  return store.brackets
    .filter((item) => item.tournamentId === tournamentId)
    .map((item) => normalizeBracket(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLatestBracketByTournamentId(tournamentId: string): Promise<Bracket | null> {
  const brackets = await listBracketsByTournamentId(tournamentId);
  return brackets[0] ?? null;
}

export async function updateBracketMatchResult(params: {
  tournamentId: string;
  matchId: string;
  winnerUserId: string | null;
  actorUserId?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  if (!tournamentId || !matchId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const normalizedWinnerUserId = params.winnerUserId === null ? null : params.winnerUserId.trim();
  if (normalizedWinnerUserId !== null && !normalizedWinnerUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const store = await readStore();
  const tournament = store.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const latestBracket = store.brackets
    .filter((item) => item.tournamentId === tournamentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as MutableBracket | undefined;
  if (!latestBracket) {
    return { ok: false, error: "확정 브래킷이 없습니다." };
  }

  applyBracketDefaultsInPlace(latestBracket);

  let targetRound: MutableBracketRound | null = null;
  let targetMatch: MutableBracketMatch | null = null;
  for (const round of latestBracket.rounds) {
    const match = round.matches.find((item) => item.id === matchId);
    if (match) {
      targetRound = round;
      targetMatch = match;
      break;
    }
  }
  if (!targetRound || !targetMatch) {
    return { ok: false, error: "대상 매치를 찾을 수 없습니다." };
  }
  if (latestBracket.rounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
    return { ok: false, error: "다음 라운드가 이미 생성되어 있어 수정할 수 없습니다." };
  }

  const previousStatus = targetMatch.status;
  const previousWinnerUserId = targetMatch.winnerUserId;
  const previousWinnerName = targetMatch.winnerName;
  let actionType = "MATCH_RESULT_SET";

  if (normalizedWinnerUserId === null) {
    if (targetMatch.status === "PENDING" && !targetMatch.winnerUserId) {
      return { ok: false, error: "이미 처리된 상태입니다." };
    }
    targetMatch.winnerUserId = null;
    targetMatch.winnerName = null;
    targetMatch.status = "PENDING";
    actionType = "MATCH_RESULT_RESET";
  } else {
    const winner =
      targetMatch.player1.userId === normalizedWinnerUserId
        ? targetMatch.player1
        : targetMatch.player2.userId === normalizedWinnerUserId
          ? targetMatch.player2
          : null;
    if (!winner) {
      return { ok: false, error: "승자는 player1 또는 player2 중 하나여야 합니다." };
    }
    if (targetMatch.status === "COMPLETED" && targetMatch.winnerUserId === winner.userId) {
      return { ok: false, error: "이미 처리된 상태입니다." };
    }

    targetMatch.winnerUserId = winner.userId;
    targetMatch.winnerName = winner.name;
    targetMatch.status = "COMPLETED";
    actionType = previousStatus === "COMPLETED" ? "MATCH_RESULT_UPDATED" : "MATCH_RESULT_SET";
  }

  targetRound.status = deriveRoundStatus(targetRound.matches);
  for (const round of latestBracket.rounds) {
    round.status = deriveRoundStatus(round.matches);
  }

  appendAuditLogSafe(store, {
    actorUserId: params.actorUserId,
    actionType,
    targetType: "match",
    targetId: matchId,
    meta: {
      tournamentId,
      roundNumber: targetRound.roundNumber,
      previousStatus,
      nextStatus: targetMatch.status,
      previousWinnerUserId,
      previousWinnerName,
      nextWinnerUserId: targetMatch.winnerUserId,
      nextWinnerName: targetMatch.winnerName,
    },
  });

  await writeStore(store);
  return { ok: true, bracket: normalizeBracket(latestBracket as Bracket) };
}

export async function replaceBracketMatchPlayer(params: {
  tournamentId: string;
  matchId: string;
  slot: "player1" | "player2";
  replacementUserId: string;
  actorUserId?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  const replacementUserId = params.replacementUserId.trim();
  if (!tournamentId || !matchId || !replacementUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (params.slot !== "player1" && params.slot !== "player2") {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const store = await readStore();
  const tournament = store.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const latestBracket = store.brackets
    .filter((item) => item.tournamentId === tournamentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as MutableBracket | undefined;
  if (!latestBracket) {
    return { ok: false, error: "확정 브래킷이 없습니다." };
  }

  applyBracketDefaultsInPlace(latestBracket);

  let targetRound: MutableBracketRound | null = null;
  let targetMatch: MutableBracketMatch | null = null;
  for (const round of latestBracket.rounds) {
    const match = round.matches.find((item) => item.id === matchId);
    if (match) {
      targetRound = round;
      targetMatch = match;
      break;
    }
  }
  if (!targetRound || !targetMatch) {
    return { ok: false, error: "대상 매치를 찾을 수 없습니다." };
  }
  if (latestBracket.rounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
    return { ok: false, error: "다음 라운드가 이미 생성되어 참가자를 교체할 수 없습니다." };
  }

  const playerMap = new Map<string, BracketPlayer>();
  for (const round of latestBracket.rounds) {
    for (const match of round.matches) {
      playerMap.set(match.player1.userId, match.player1);
      playerMap.set(match.player2.userId, match.player2);
    }
  }
  const replacement = playerMap.get(replacementUserId);
  if (!replacement) {
    return { ok: false, error: "같은 브래킷 참가자만 교체할 수 있습니다." };
  }

  const currentPlayerUserId = params.slot === "player1" ? targetMatch.player1.userId : targetMatch.player2.userId;
  if (replacement.userId === currentPlayerUserId) {
    return { ok: false, error: "이미 처리된 상태입니다." };
  }

  const oppositeUserId = params.slot === "player1" ? targetMatch.player2.userId : targetMatch.player1.userId;
  if (replacement.userId === oppositeUserId) {
    return { ok: false, error: "동일 매치 내 중복 참가자는 허용되지 않습니다." };
  }

  const previousPlayer = params.slot === "player1" ? targetMatch.player1 : targetMatch.player2;

  if (params.slot === "player1") {
    targetMatch.player1 = replacement;
  } else {
    targetMatch.player2 = replacement;
  }

  targetMatch.winnerUserId = null;
  targetMatch.winnerName = null;
  targetMatch.status = "PENDING";
  for (const round of latestBracket.rounds) {
    round.status = deriveRoundStatus(round.matches);
  }

  appendAuditLogSafe(store, {
    actorUserId: params.actorUserId,
    actionType: "MATCH_PLAYER_REPLACED",
    targetType: "match",
    targetId: matchId,
    meta: {
      tournamentId,
      roundNumber: targetRound.roundNumber,
      slot: params.slot,
      previousPlayerUserId: previousPlayer.userId,
      previousPlayerName: previousPlayer.name,
      replacementPlayerUserId: replacement.userId,
      replacementPlayerName: replacement.name,
    },
  });

  await writeStore(store);
  return { ok: true, bracket: normalizeBracket(latestBracket as Bracket) };
}

export async function advanceBracketRound(
  bracketId: string,
  roundNumber: number
): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  const store = await readStore();
  const bracket = store.brackets.find((item) => item.id === bracketId) as MutableBracket | undefined;
  if (!bracket) {
    return { ok: false, error: "브래킷을 찾을 수 없습니다." };
  }

  applyBracketDefaultsInPlace(bracket);

  const currentRound = bracket.rounds.find((round) => round.roundNumber === roundNumber);
  if (!currentRound) {
    return { ok: false, error: "대상 라운드를 찾을 수 없습니다." };
  }
  if (currentRound.status !== "COMPLETED") {
    return { ok: false, error: "현재 라운드가 아직 완료되지 않았습니다." };
  }
  if (bracket.rounds.some((round) => round.roundNumber === roundNumber + 1)) {
    return { ok: false, error: "다음 라운드가 이미 생성되어 있습니다." };
  }

  const winners = currentRound.matches
    .map((match) =>
      match.status === "COMPLETED" && match.winnerUserId && match.winnerName
        ? { userId: match.winnerUserId, name: match.winnerName }
        : null
    )
    .filter((item): item is BracketPlayer => item !== null);

  const pairCount = Math.floor(winners.length / 2);
  if (pairCount === 0) {
    return { ok: false, error: "다음 라운드를 만들 승자 페어가 부족합니다." };
  }

  const nextMatches: MutableBracketMatch[] = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const p1 = winners[i];
    const p2 = winners[i + 1];
    nextMatches.push({
      id: randomUUID(),
      player1: p1,
      player2: p2,
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }

  bracket.rounds.push({
    roundNumber: roundNumber + 1,
    matches: nextMatches,
    status: "PENDING",
  });
  for (const round of bracket.rounds) {
    round.status = deriveRoundStatus(round.matches);
  }

  await writeStore(store);
  return { ok: true, bracket: normalizeBracket(bracket as Bracket) };
}

export async function markTournamentApplicationOcrProcessing(params: {
  tournamentId: string;
  entryId: string;
}): Promise<TournamentApplication | null> {
  const store = await readStore();
  const target = store.tournamentApplications.find(
    (item) => item.tournamentId === params.tournamentId && item.id === params.entryId
  );
  if (!target) return null;

  const now = new Date().toISOString();
  target.ocrStatus = "PROCESSING";
  target.ocrRequestedAt = now;
  target.updatedAt = now;
  await writeStore(store);
  return target;
}

export async function completeTournamentApplicationOcr(params: {
  tournamentId: string;
  entryId: string;
  text: string;
  rawResult: string;
  failed?: boolean;
}): Promise<TournamentApplication | null> {
  const store = await readStore();
  const target = store.tournamentApplications.find(
    (item) => item.tournamentId === params.tournamentId && item.id === params.entryId
  );
  if (!target) return null;

  const now = new Date().toISOString();
  target.ocrStatus = params.failed ? "FAILED" : "COMPLETED";
  target.ocrText = params.text;
  target.ocrRawResult = params.rawResult;
  target.ocrCompletedAt = now;
  target.updatedAt = now;
  await writeStore(store);
  return target;
}

const ALLOWED_TOURNAMENT_APPLICATION_TRANSITIONS: Record<
  TournamentApplicationStatus,
  TournamentApplicationStatus[]
> = {
  APPLIED: ["VERIFYING", "REJECTED"],
  VERIFYING: ["WAITING_PAYMENT", "REJECTED"],
  WAITING_PAYMENT: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function getAllowedTournamentApplicationNextStatuses(
  currentStatus: TournamentApplicationStatus
): TournamentApplicationStatus[] {
  return ALLOWED_TOURNAMENT_APPLICATION_TRANSITIONS[currentStatus] ?? [];
}

export async function updateTournamentApplicationStatus(params: {
  tournamentId: string;
  entryId: string;
  nextStatus: TournamentApplicationStatus;
  actorUserId?: string;
}): Promise<{ ok: true; application: TournamentApplication } | { ok: false; error: string }> {
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const store = await readStore();
  const tournament = store.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const application = store.tournamentApplications.find(
    (item) => item.tournamentId === tournamentId && item.id === entryId
  );
  if (!application) {
    return { ok: false, error: "참가신청을 찾을 수 없습니다." };
  }

  const currentStatus = application.status || "APPLIED";
  if (currentStatus === params.nextStatus) {
    return { ok: false, error: "이미 처리된 상태입니다." };
  }
  const allowedNext = getAllowedTournamentApplicationNextStatuses(currentStatus);
  if (!allowedNext.includes(params.nextStatus)) {
    return { ok: false, error: "허용되지 않은 상태 전이입니다." };
  }

  const now = new Date().toISOString();
  const previousStatus = currentStatus;
  application.status = params.nextStatus;
  application.updatedAt = now;
  application.statusChangedAt = now;

  const tournamentTitle = tournament?.title ?? "대회";
  let notificationTitle = "";
  let notificationMessage = "";
  if (previousStatus === "VERIFYING" && params.nextStatus === "WAITING_PAYMENT") {
    notificationTitle = "검증 완료, 입금 필요";
    notificationMessage = `${tournamentTitle}: 검증이 완료되었습니다. 입금을 진행해 주세요.`;
  } else if (previousStatus === "WAITING_PAYMENT" && params.nextStatus === "APPROVED") {
    notificationTitle = "입금 확인, 참가 확정";
    notificationMessage = `${tournamentTitle}: 입금 확인이 완료되어 참가가 확정되었습니다.`;
  } else if (params.nextStatus === "REJECTED") {
    notificationTitle = "참가 제한 안내";
    notificationMessage = `${tournamentTitle}: 참가가 제한되었습니다. 운영자 안내를 확인해 주세요.`;
  }
  if (notificationTitle) {
    store.notifications.push({
      id: randomUUID(),
      userId: application.userId,
      title: notificationTitle,
      message: notificationMessage,
      relatedTournamentId: tournamentId,
      createdAt: now,
      isRead: false,
    });
  }

  appendAuditLogSafe(store, {
    actorUserId: params.actorUserId,
    actionType: "APPLICATION_STATUS_CHANGED",
    targetType: "application",
    targetId: entryId,
    meta: {
      tournamentId,
      previousStatus,
      nextStatus: params.nextStatus,
    },
  });
  if (previousStatus === "WAITING_PAYMENT" && params.nextStatus === "APPROVED") {
    appendAuditLogSafe(store, {
      actorUserId: params.actorUserId,
      actionType: "PAYMENT_CONFIRMED",
      targetType: "application",
      targetId: entryId,
      meta: {
        tournamentId,
      },
    });
  } else if (params.nextStatus === "APPROVED") {
    appendAuditLogSafe(store, {
      actorUserId: params.actorUserId,
      actionType: "APPLICATION_APPROVED",
      targetType: "application",
      targetId: entryId,
      meta: {
        tournamentId,
      },
    });
  } else if (params.nextStatus === "REJECTED") {
    appendAuditLogSafe(store, {
      actorUserId: params.actorUserId,
      actionType: "APPLICATION_REJECTED",
      targetType: "application",
      targetId: entryId,
      meta: {
        tournamentId,
      },
    });
  }

  await writeStore(store);

  return {
    ok: true,
    application: {
      ...application,
      updatedAt: application.updatedAt || now,
      statusChangedAt: application.statusChangedAt || now,
    },
  };
}

export async function listNotificationsByUserId(userId: string, limit = 20): Promise<UserNotification[]> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return [];
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, normalizedUserId);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return store.notifications
    .filter((item) => item.userId === canonicalUserId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}

export async function markNotificationAsRead(params: {
  userId: string;
  notificationId: string;
}): Promise<UserNotification | null> {
  const userId = params.userId.trim();
  const notificationId = params.notificationId.trim();
  if (!userId || !notificationId) return null;
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, userId);
  const notification = store.notifications.find(
    (item) => item.id === notificationId && item.userId === canonicalUserId
  );
  if (!notification) return null;
  notification.isRead = true;
  await writeStore(store);
  return notification;
}

export async function markAllNotificationsAsReadForUser(userId: string): Promise<{ updated: number }> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return { updated: 0 };
  const store = await readStore();
  const canonicalUserId = resolveCanonicalUserId(store, normalizedUserId);
  let updated = 0;
  for (const n of store.notifications) {
    if (n.userId === canonicalUserId && !n.isRead) {
      n.isRead = true;
      updated += 1;
    }
  }
  if (updated > 0) {
    await writeStore(store);
  }
  return { updated };
}

export async function getSitePageBuilderDraftByPageId(pageId: string): Promise<SitePageBuilderDraft | null> {
  const normalizedPageId = pageId.trim();
  if (!normalizedPageId) return null;
  const store = await readStore();
  const draft = store.sitePageBuilderDrafts.find((item) => item.pageId === normalizedPageId);
  if (!draft) return null;
  return {
    ...draft,
    sections: Array.isArray(draft.sections)
      ? draft.sections
          .map((section) => normalizeSitePageBuilderDraftSection(section))
          .filter((section): section is SitePageBuilderDraftSection => section !== null)
      : [],
  };
}

export async function upsertSitePageBuilderDraft(params: {
  pageId: string;
  sections: SitePageBuilderDraftSection[];
  actorUserId: string;
}): Promise<{ ok: true; draft: SitePageBuilderDraft } | { ok: false; error: string }> {
  const pageId = params.pageId.trim();
  const actorUserId = params.actorUserId.trim();
  if (!pageId || !actorUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(params.sections)) {
    return { ok: false, error: "sections는 배열이어야 합니다." };
  }
  const normalizedSections = params.sections
    .map((section) => normalizeSitePageBuilderDraftSection(section))
    .filter((section): section is SitePageBuilderDraftSection => section !== null)
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index + 1,
    }));

  const store = await readStore();
  const now = new Date().toISOString();
  const nextDraft: SitePageBuilderDraft = {
    pageId,
    sections: normalizedSections,
    savedAt: now,
    savedBy: actorUserId,
  };
  const index = store.sitePageBuilderDrafts.findIndex((item) => item.pageId === pageId);
  if (index >= 0) {
    store.sitePageBuilderDrafts[index] = nextDraft;
  } else {
    store.sitePageBuilderDrafts.push(nextDraft);
  }
  await writeStore(store);
  return { ok: true, draft: nextDraft };
}

export async function getSitePageBuilderPublishedByPageId(
  pageId: string
): Promise<SitePageBuilderPublishedPage | null> {
  const normalizedPageId = pageId.trim();
  if (!normalizedPageId) return null;
  const store = await readStore();
  const published = store.sitePageBuilderPublishedPages.find((item) => item.pageId === normalizedPageId);
  if (!published) return null;
  return {
    ...published,
    sections: Array.isArray(published.sections)
      ? published.sections
          .map((section) => normalizeSitePageBuilderDraftSection(section))
          .filter((section): section is SitePageBuilderDraftSection => section !== null)
      : [],
  };
}

export async function upsertSitePageBuilderPublishedPage(params: {
  pageId: string;
  sections: SitePageBuilderDraftSection[];
  actorUserId: string;
}): Promise<{ ok: true; published: SitePageBuilderPublishedPage } | { ok: false; error: string }> {
  const pageId = params.pageId.trim();
  const actorUserId = params.actorUserId.trim();
  if (!pageId || !actorUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(params.sections)) {
    return { ok: false, error: "sections는 배열이어야 합니다." };
  }
  const normalizedSections = params.sections
    .map((section) => normalizeSitePageBuilderDraftSection(section))
    .filter((section): section is SitePageBuilderDraftSection => section !== null)
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index + 1,
    }));

  const store = await readStore();
  const now = new Date().toISOString();
  const nextPublished: SitePageBuilderPublishedPage = {
    pageId,
    sections: normalizedSections,
    publishedAt: now,
    publishedBy: actorUserId,
  };
  const index = store.sitePageBuilderPublishedPages.findIndex((item) => item.pageId === pageId);
  if (index >= 0) {
    store.sitePageBuilderPublishedPages[index] = nextPublished;
  } else {
    store.sitePageBuilderPublishedPages.push(nextPublished);
  }
  await writeStore(store);
  return { ok: true, published: nextPublished };
}

export async function getSiteLayoutConfig(): Promise<SiteLayoutConfig> {
  const readStrategy = resolveSiteLayoutConfigReadStrategy();
  if (readStrategy === "firestore-kv") {
    try {
      const raw = await readSiteLayoutConfigRawFromFirestoreKv();
      if (raw != null) return normalizeSiteLayoutConfig(raw);
    } catch (e) {
      console.warn("[dev-store] getSiteLayoutConfig Firestore read failed; using defaults", e);
    }
    return normalizeSiteLayoutConfig(undefined);
  }
  if (readStrategy === "production-defaults-only") {
    return normalizeSiteLayoutConfig(undefined);
  }
  const store = await readStore();
  return normalizeSiteLayoutConfig(store.siteLayoutConfig);
}

export async function patchSiteLayoutConfig(params: {
  header?: SiteLayoutConfig["header"];
  footer?: SiteLayoutConfig["footer"];
}): Promise<SiteLayoutConfig> {
  const writeStrategy = resolveSiteLayoutConfigWriteStrategy();
  if (writeStrategy === "firestore-kv") {
    const raw = await readSiteLayoutConfigRawFromFirestoreKv();
    const current = normalizeSiteLayoutConfig(raw ?? undefined);
    const next: SiteLayoutConfig = {
      header: params.header
        ? normalizeSiteLayoutConfig({ header: params.header, footer: current.footer }).header
        : current.header,
      footer: params.footer
        ? normalizeSiteLayoutConfig({ header: current.header, footer: params.footer }).footer
        : current.footer,
    };
    await upsertSiteLayoutConfigToFirestoreKv(next);
    return next;
  }
  if (writeStrategy === "blocked") {
    throwSiteLayoutConfigWritePersistenceBlocked();
  }
  const store = await readStore();
  const current = normalizeSiteLayoutConfig(store.siteLayoutConfig);
  const next: SiteLayoutConfig = {
    header: params.header ? normalizeSiteLayoutConfig({ header: params.header, footer: current.footer }).header : current.header,
    footer: params.footer ? normalizeSiteLayoutConfig({ header: current.header, footer: params.footer }).footer : current.footer,
  };
  store.siteLayoutConfig = next;
  await writeStore(store);
  return next;
}

export async function getSiteNotice(): Promise<SiteNotice> {
  const readStrategy = resolveSiteNoticeReadStrategy();
  if (readStrategy === "firestore-kv") {
    try {
      const raw = await readSiteNoticeRawFromFirestoreKv();
      if (raw != null) return normalizeSiteNotice(raw);
    } catch (e) {
      console.warn("[dev-store] getSiteNotice Firestore read failed; using defaults", e);
    }
    return normalizeSiteNotice(undefined);
  }
  if (readStrategy === "production-defaults-only") {
    return normalizeSiteNotice(undefined);
  }
  const store = await readStore();
  return normalizeSiteNotice(store.siteNotice);
}

export async function patchSiteNotice(params: {
  enabled?: boolean;
  text?: string;
}): Promise<SiteNotice> {
  const writeStrategy = resolveSiteNoticeWriteStrategy();
  if (writeStrategy === "firestore-kv") {
    const raw = await readSiteNoticeRawFromFirestoreKv();
    const current = normalizeSiteNotice(raw ?? undefined);
    const next: SiteNotice = {
      enabled: params.enabled ?? current.enabled,
      text: params.text !== undefined ? params.text.trim() : current.text,
    };
    await upsertSiteNoticeToFirestoreKv(next);
    return next;
  }
  if (writeStrategy === "blocked") {
    throwSiteNoticeWritePersistenceBlocked();
  }
  const store = await readStore();
  const current = normalizeSiteNotice(store.siteNotice);
  const next: SiteNotice = {
    enabled: params.enabled ?? current.enabled,
    text: params.text !== undefined ? params.text.trim() : current.text,
  };
  store.siteNotice = next;
  await writeStore(store);
  return next;
}

export async function getSiteCommunityConfig(): Promise<SiteCommunityConfig> {
  const readStrategy = resolveSiteCommunityConfigReadStrategy();
  if (readStrategy === "firestore-kv") {
    try {
      const raw = await readSiteCommunityConfigRawFromFirestoreKv();
      if (raw != null) return normalizeSiteCommunityConfig(raw);
    } catch (e) {
      console.warn("[dev-store] getSiteCommunityConfig Firestore read failed; using defaults", e);
    }
    return normalizeSiteCommunityConfig(undefined);
  }
  if (readStrategy === "production-defaults-only") {
    return normalizeSiteCommunityConfig(undefined);
  }
  const store = await readStore();
  return normalizeSiteCommunityConfig(store.siteCommunityConfig);
}

export async function patchSiteCommunityConfig(params: {
  free?: Partial<SiteCommunityBoardConfig>;
  qna?: Partial<SiteCommunityBoardConfig>;
  reviews?: Partial<SiteCommunityBoardConfig>;
  extra1?: Partial<SiteCommunityBoardConfig>;
  extra2?: Partial<SiteCommunityBoardConfig>;
}): Promise<SiteCommunityConfig> {
  const writeStrategy = resolveSiteCommunityConfigWriteStrategy();
  if (writeStrategy === "firestore-kv") {
    const raw = await readSiteCommunityConfigRawFromFirestoreKv();
    const current = normalizeSiteCommunityConfig(raw ?? undefined);
    const next: SiteCommunityConfig = {
      free: normalizeSiteCommunityBoardConfig(params.free ?? current.free, current.free),
      qna: normalizeSiteCommunityBoardConfig(params.qna ?? current.qna, current.qna),
      reviews: normalizeSiteCommunityBoardConfig(params.reviews ?? current.reviews, current.reviews),
      extra1: normalizeSiteCommunityBoardConfig(params.extra1 ?? current.extra1, current.extra1),
      extra2: normalizeSiteCommunityBoardConfig(params.extra2 ?? current.extra2, current.extra2),
    };
    await upsertSiteCommunityConfigToFirestoreKv(next);
    return next;
  }
  if (writeStrategy === "blocked") {
    throwSiteCommunityConfigWritePersistenceBlocked();
  }
  const store = await readStore();
  const current = normalizeSiteCommunityConfig(store.siteCommunityConfig);
  const next: SiteCommunityConfig = {
    free: normalizeSiteCommunityBoardConfig(params.free ?? current.free, current.free),
    qna: normalizeSiteCommunityBoardConfig(params.qna ?? current.qna, current.qna),
    reviews: normalizeSiteCommunityBoardConfig(params.reviews ?? current.reviews, current.reviews),
    extra1: normalizeSiteCommunityBoardConfig(params.extra1 ?? current.extra1, current.extra1),
    extra2: normalizeSiteCommunityBoardConfig(params.extra2 ?? current.extra2, current.extra2),
  };
  store.siteCommunityConfig = next;
  await writeStore(store);
  return next;
}

export function parseCommunityBoardTypeParam(raw: string): SiteCommunityBoardKey | null {
  const t = raw.trim();
  return isSiteCommunityBoardKey(t) ? t : null;
}

/** 커뮤니티 허브 상단 탭(4칸): 자유·질문·대회후기·구인구직 매핑용 */
export const COMMUNITY_PRIMARY_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1"];

function mapPostToListItem(p: CommunityBoardPost): CommunityPostListItem {
  const imageUrls = normalizeCommunityPostImageUrls(p.imageUrls);
  const thumbnailUrl = imageUrls.length > 0 ? imageUrls[0]! : null;
  return {
    id: p.id,
    boardType: p.boardType,
    title: p.title,
    nickname: p.authorNickname,
    createdAt: p.createdAt,
    viewCount: p.viewCount,
    commentCount: p.commentCount,
    thumbnailUrl,
  };
}

/** primary 4개 게시판만 한 번에 필터·정렬 — 프론트에서 게시판별 다중 요청 금지 */
export async function listCommunityPostsAllPrimary(
  visibleBoardKeys: SiteCommunityBoardKey[],
  options?: { q?: string }
): Promise<CommunityPostListItem[]> {
  const store = await readStore();
  const q = options?.q?.trim().toLowerCase() ?? "";
  const primaryAllow = new Set(
    COMMUNITY_PRIMARY_BOARD_KEYS.filter((k) => visibleBoardKeys.includes(k)),
  );
  let rows = store.communityPosts.filter(
    (p) => primaryAllow.has(p.boardType) && p.isDeleted !== true,
  );
  if (q.length > 0) {
    rows = rows.filter((p) => p.title.toLowerCase().includes(q));
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(mapPostToListItem);
}

export async function listCommunityPosts(
  boardType: SiteCommunityBoardKey,
  options?: { q?: string }
): Promise<CommunityPostListItem[]> {
  const store = await readStore();
  const q = options?.q?.trim().toLowerCase() ?? "";
  let rows = store.communityPosts.filter((p) => p.boardType === boardType && p.isDeleted !== true);
  if (q.length > 0) {
    rows = rows.filter((p) => p.title.toLowerCase().includes(q));
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(mapPostToListItem);
}

export async function getCommunityPostById(postId: string): Promise<CommunityPostDetail | null> {
  const store = await readStore();
  const id = postId.trim();
  const p = store.communityPosts.find((x) => x.id === id);
  if (!p || p.isDeleted === true) return null;
  const imageUrls = normalizeCommunityPostImageUrls(p.imageUrls);
  const imageSizeLevels = normalizeCommunityPostImageSizeLevels(imageUrls.length, p.imageSizeLevels);
  return {
    id: p.id,
    boardType: p.boardType,
    title: p.title,
    content: p.content,
    imageUrls,
    imageSizeLevels,
    authorUserId: p.authorUserId,
    authorNickname: p.authorNickname,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    viewCount: p.viewCount,
    commentCount: p.commentCount,
  };
}

export async function incrementCommunityPostViewCount(postId: string): Promise<number | null> {
  const store = await readStore();
  const id = postId.trim();
  const p = store.communityPosts.find((x) => x.id === id);
  if (!p || p.isDeleted === true) return null;
  p.viewCount = (p.viewCount ?? 0) + 1;
  p.updatedAt = new Date().toISOString();
  await writeStore(store);
  return p.viewCount;
}

export async function createCommunityPost(params: {
  boardType: SiteCommunityBoardKey;
  title: string;
  content: string;
  imageUrls?: unknown;
  imageSizeLevels?: unknown;
  authorUserId: string;
  authorNickname: string;
}): Promise<{ ok: true; post: CommunityBoardPost } | { ok: false; error: string }> {
  const title = params.title.trim();
  const content = params.content.trim();
  if (!title || !content) {
    return { ok: false, error: "제목과 내용을 입력해 주세요." };
  }
  const authorUserId = params.authorUserId.trim();
  const authorNickname = params.authorNickname.trim();
  if (!authorUserId || !authorNickname) {
    return { ok: false, error: "작성자 정보가 없습니다." };
  }
  const imageUrls = normalizeCommunityPostImageUrls(params.imageUrls);
  const imageSizeLevels = normalizeCommunityPostImageSizeLevels(imageUrls.length, params.imageSizeLevels);

  const store = await readStore();
  const now = new Date().toISOString();
  const post: CommunityBoardPost = {
    id: `cm-${randomUUID()}`,
    boardType: params.boardType,
    title,
    content,
    imageUrls,
    imageSizeLevels,
    authorUserId,
    authorNickname,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    commentCount: 0,
    isDeleted: false,
  };
  store.communityPosts.push(post);
  await writeStore(store);
  return { ok: true, post };
}

export async function isCommunityPostAuthor(postAuthorUserId: string, editorUserId: string): Promise<boolean> {
  const store = await readStore();
  return resolveCanonicalUserId(store, postAuthorUserId) === resolveCanonicalUserId(store, editorUserId);
}

export async function updateCommunityPostById(
  postId: string,
  editorUserId: string,
  params: { title: string; content: string; imageUrls?: unknown; imageSizeLevels?: unknown }
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" }> {
  const title = params.title.trim();
  const content = params.content.trim();
  if (!title || !content) {
    return { ok: false, code: "INVALID" };
  }
  const imageUrls = normalizeCommunityPostImageUrls(params.imageUrls);
  const imageSizeLevels = normalizeCommunityPostImageSizeLevels(imageUrls.length, params.imageSizeLevels);
  const store = await readStore();
  const id = postId.trim();
  const p = store.communityPosts.find((x) => x.id === id);
  if (!p || p.isDeleted === true) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (resolveCanonicalUserId(store, p.authorUserId) !== resolveCanonicalUserId(store, editorUserId)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  p.title = title;
  p.content = content;
  p.imageUrls = imageUrls;
  p.imageSizeLevels = imageSizeLevels;
  p.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { ok: true };
}

export async function softDeleteCommunityPostById(
  postId: string,
  editorUserId: string
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" }> {
  const store = await readStore();
  const id = postId.trim();
  const p = store.communityPosts.find((x) => x.id === id);
  if (!p || p.isDeleted === true) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (resolveCanonicalUserId(store, p.authorUserId) !== resolveCanonicalUserId(store, editorUserId)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  p.isDeleted = true;
  p.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { ok: true };
}

export async function listCommentsByPostId(postId: string): Promise<CommunityCommentListItem[]> {
  const store = await readStore();
  const list = Array.isArray(store.communityComments) ? store.communityComments : [];
  const pid = postId.trim();
  return list
    .filter((c) => c.postId === pid && c.isDeleted !== true)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({
      id: c.id,
      authorUserId: c.authorUserId,
      authorNickname: c.authorNickname,
      content: c.content,
      createdAt: c.createdAt,
    }));
}

/** 게시글 commentCount만 조정 (댓글 생성/삭제는 createComment·softDeleteComment에서 일괄 처리) */
export async function incrementPostCommentCount(postId: string): Promise<void> {
  const store = await readStore();
  const p = store.communityPosts.find((x) => x.id === postId.trim());
  if (!p || p.isDeleted === true) return;
  p.commentCount = (p.commentCount ?? 0) + 1;
  p.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function decrementPostCommentCount(postId: string): Promise<void> {
  const store = await readStore();
  const p = store.communityPosts.find((x) => x.id === postId.trim());
  if (!p || p.isDeleted === true) return;
  p.commentCount = Math.max(0, (p.commentCount ?? 0) - 1);
  p.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function createComment(
  postId: string,
  authorUserId: string,
  authorNickname: string,
  content: string
): Promise<{ ok: true; comment: CommunityComment } | { ok: false; error: string }> {
  const text = content.trim();
  if (!text) return { ok: false, error: "내용을 입력해 주세요." };
  const store = await readStore();
  if (!Array.isArray(store.communityComments)) store.communityComments = [];
  const pid = postId.trim();
  const post = store.communityPosts.find((x) => x.id === pid);
  if (!post || post.isDeleted === true) return { ok: false, error: "게시글을 찾을 수 없습니다." };
  const now = new Date().toISOString();
  const comment: CommunityComment = {
    id: `cc-${randomUUID()}`,
    postId: pid,
    authorUserId: authorUserId.trim(),
    authorNickname: authorNickname.trim(),
    content: text,
    createdAt: now,
    isDeleted: false,
  };
  store.communityComments.push(comment);
  post.commentCount = (post.commentCount ?? 0) + 1;
  post.updatedAt = now;
  await writeStore(store);
  return { ok: true, comment };
}

export async function softDeleteComment(
  commentId: string,
  editorUserId: string
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" }> {
  const store = await readStore();
  if (!Array.isArray(store.communityComments)) store.communityComments = [];
  const id = commentId.trim();
  const c = store.communityComments.find((x) => x.id === id);
  if (!c || c.isDeleted === true) return { ok: false, code: "NOT_FOUND" };
  if (resolveCanonicalUserId(store, c.authorUserId) !== resolveCanonicalUserId(store, editorUserId)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  c.isDeleted = true;
  const post = store.communityPosts.find((x) => x.id === c.postId);
  if (post && post.isDeleted !== true) {
    post.commentCount = Math.max(0, (post.commentCount ?? 0) - 1);
    post.updatedAt = new Date().toISOString();
  }
  await writeStore(store);
  return { ok: true };
}

function normalizeSnapshotSourceType(
  item: PublishedCardSnapshot & { targetDetailUrl?: string; snapshotSourceType?: string }
): CardSnapshotSourceType {
  if (item.snapshotSourceType === "VENUE_SNAPSHOT") return "VENUE_SNAPSHOT";
  if (item.snapshotSourceType === "TOURNAMENT_SNAPSHOT") return "TOURNAMENT_SNAPSHOT";
  if (typeof item.targetDetailUrl === "string" && item.targetDetailUrl.startsWith("/site/venues/")) {
    return "VENUE_SNAPSHOT";
  }
  return "TOURNAMENT_SNAPSHOT";
}

function normalizeTemplateType(
  item: PublishedCardSnapshot & { templateType?: unknown },
  snapshotSourceType: CardSnapshotSourceType
): MainCardTemplateType {
  if (item.templateType === "venue") return "venue";
  if (item.templateType === "tournament") return "tournament";
  return snapshotSourceType === "VENUE_SNAPSHOT" ? "venue" : "tournament";
}

function getSnapshotSourceKey(snapshot: PublishedCardSnapshot): string {
  return `${snapshot.snapshotSourceType}:${snapshot.tournamentId}`;
}

function tournamentDateLocationMeta(
  store: DevStore,
  tournamentId: string
): { date: string; location: string } {
  const tour = store.tournaments.find((item) => item.id === tournamentId.trim());
  return {
    date: typeof tour?.date === "string" ? tour.date : "",
    location: typeof tour?.location === "string" ? tour.location : "",
  };
}

function tournamentPublishedCardToPublishedSnapshot(
  t: TournamentPublishedCard,
  templateId: string,
  tournamentMeta?: { date: string; location: string } | null
): PublishedCardSnapshot {
  const line1 = t.textLine1?.trim() ?? "";
  const line2 = t.textLine2?.trim() ?? "";
  const storedDate = typeof t.cardDisplayDate === "string" ? t.cardDisplayDate.trim() : "";
  const storedLoc = typeof t.cardDisplayLocation === "string" ? t.cardDisplayLocation.trim() : "";
  const fbDate = (tournamentMeta?.date ?? "").trim();
  const fbLoc = (tournamentMeta?.location ?? "").trim();
  const datePart = storedDate || fbDate;
  const locPart = storedLoc || fbLoc;
  const subtitle = [datePart, locPart].filter((x) => x.length > 0).join(" · ");
  const snap: PublishedCardSnapshot = {
    snapshotId: t.snapshotId,
    tournamentId: t.tournamentId,
    snapshotSourceType: "TOURNAMENT_SNAPSHOT",
    templateType: "tournament",
    templateId,
    tournamentCardTemplate: t.templateType,
    tournamentBackgroundType: t.backgroundType,
    tournamentTheme: t.themeType,
    statusBadge: normalizeTournamentStatusBadge(t.status),
    cardExtraLine1: line1 || null,
    cardExtraLine2: line2 || null,
    title: t.title.trim(),
    subtitle,
    imageId: t.imageId,
    image320Url: t.image320Url,
    image640Url: t.image320Url || t.image320Url,
    textLayout: "v2",
    imageLayout: "v2",
    publishedAt: t.publishedAt,
    targetDetailUrl: t.targetDetailUrl,
    deadlineSortValue: t.deadlineSortValue,
    isPublished: t.isPublished,
    version: t.version,
    isActive: t.isActive,
    updatedAt: t.updatedAt,
    publishedBy: t.publishedBy,
  };
  if (typeof t.mediaBackground === "string") {
    snap.tournamentMediaBackground = t.mediaBackground;
  }
  if (typeof t.imageOverlayBlend === "boolean") {
    snap.tournamentImageOverlayBlend = t.imageOverlayBlend;
  }
  if (typeof t.imageOverlayOpacity === "number") {
    snap.tournamentImageOverlayOpacity = t.imageOverlayOpacity;
  }
  if (typeof t.cardDisplayDate === "string") {
    snap.tournamentCardDisplayDate = t.cardDisplayDate;
  }
  if (typeof t.cardDisplayLocation === "string") {
    snap.tournamentCardDisplayLocation = t.cardDisplayLocation;
  }
  return snap;
}

/** 대회 게시카드 v2 저장·게시 */
export async function upsertTournamentPublishedCard(params: {
  tournamentId: string;
  title: string;
  textLine1: string | null;
  textLine2: string | null;
  templateType: TournamentCardTemplate;
  backgroundType: TournamentCardBackground;
  themeType: TournamentCardTheme;
  image320Url: string;
  imageId: string;
  targetDetailUrl: string;
  publishedBy: string;
  draftOnly: boolean;
  mediaBackground?: string | null;
  imageOverlayBlend?: boolean;
  imageOverlayOpacity?: number;
  cardDisplayDate?: string | null;
  cardDisplayLocation?: string | null;
}): Promise<{ ok: true; snapshot: PublishedCardSnapshot } | { ok: false; error: string }> {
  const title = params.title.trim();
  if (!title) return { ok: false, error: "카드 제목을 입력해 주세요." };

  let imageId = params.imageId.trim();
  let image320Url = params.image320Url.trim();
  if (params.backgroundType === "image") {
    if (!imageId || !image320Url) {
      return { ok: false, error: "이미지 배경을 쓰려면 이미지를 업로드해 주세요." };
    }
  } else {
    imageId = imageId || "theme";
    image320Url = "";
  }

  const targetDetailUrl = params.targetDetailUrl.trim();
  if (!targetDetailUrl.startsWith("/")) return { ok: false, error: "상세 이동 경로가 올바르지 않습니다." };

  const store = await readStore();
  const tournament = store.tournaments.find((item) => item.id === params.tournamentId.trim());
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;

  const statusStr = String(normalizeTournamentStatusBadge(tournament.statusBadge));
  const showOnMainSlide = tournamentStatusEligibleForMainSlide(statusStr);
  const now = new Date().toISOString();

  const tid = params.tournamentId.trim();
  /** 초안 저장: 이전 초안(비활성)만 제거. 게시: 해당 대회 카드 전부 제거 후 새 게시 스냅샷 1건만 둔다. */
  if (params.draftOnly) {
    store.tournamentPublishedCards = store.tournamentPublishedCards.filter((c) => !(c.tournamentId === tid && !c.isActive));
  } else {
    store.tournamentPublishedCards = store.tournamentPublishedCards.filter((c) => c.tournamentId !== tid);
  }

  const sameTournament = store.tournamentPublishedCards.filter((c) => c.tournamentId === tid);
  const nextVersion = sameTournament.reduce((max, c) => Math.max(max, c.version), 0) + 1;

  const row: TournamentPublishedCard = {
    snapshotId: randomUUID(),
    tournamentId: params.tournamentId.trim(),
    title,
    textLine1: params.textLine1?.trim() ? params.textLine1.trim() : null,
    textLine2: params.textLine2?.trim() ? params.textLine2.trim() : null,
    templateType: params.templateType,
    backgroundType: params.backgroundType,
    themeType: params.themeType,
    image320Url,
    imageId,
    status: statusStr,
    targetDetailUrl,
    publishedAt: now,
    updatedAt: now,
    isPublished: true,
    isActive: !params.draftOnly,
    version: nextVersion,
    publishedBy: params.publishedBy,
    showOnMainSlide,
    deadlineSortValue: typeof tournament.date === "string" && tournament.date.trim() ? tournament.date : "9999-12-31",
  };
  if (params.mediaBackground !== undefined) {
    row.mediaBackground = params.mediaBackground;
  }
  if (params.imageOverlayBlend !== undefined) {
    row.imageOverlayBlend = params.imageOverlayBlend;
  }
  if (params.imageOverlayOpacity !== undefined) {
    row.imageOverlayOpacity = Math.min(1, Math.max(0.15, params.imageOverlayOpacity));
  }
  if (params.cardDisplayDate !== undefined) {
    row.cardDisplayDate = params.cardDisplayDate;
  }
  if (params.cardDisplayLocation !== undefined) {
    row.cardDisplayLocation = params.cardDisplayLocation;
  }

  store.tournamentPublishedCards.push(row);
  await writeStore(store);
  return {
    ok: true,
    snapshot: tournamentPublishedCardToPublishedSnapshot(row, templateId, {
      date: typeof tournament.date === "string" ? tournament.date : "",
      location: typeof tournament.location === "string" ? tournament.location : "",
    }),
  };
}

export async function publishVenueCardSnapshot(params: {
  venueId: string;
  templateId: string;
  templateType: MainCardTemplateType;
  title: string;
  subtitle: string;
  imageId: string;
  image320Url: string;
  image640Url: string;
  textLayout: string;
  imageLayout: string;
  publishedBy: string;
}): Promise<{ ok: true; snapshot: PublishedCardSnapshot } | { ok: false; error: string }> {
  const venueId = params.venueId.trim();
  const title = params.title.trim();
  const subtitle = params.subtitle.trim();
  const imageId = params.imageId.trim();
  const image320Url = params.image320Url.trim();
  const image640Url = params.image640Url.trim();
  const textLayout = params.textLayout.trim();
  const imageLayout = params.imageLayout.trim();
  if (!venueId) return { ok: false, error: "당구장 ID가 필요합니다." };
  if (!title) return { ok: false, error: "카드 제목을 입력해 주세요." };
  if (!imageId || !image320Url || !image640Url) {
    return { ok: false, error: "이미지 업로드 후 발행할 수 있습니다." };
  }

  const store = await readStore();
  const sameVenueSnapshots = store.publishedCardSnapshots.filter(
    (item) => item.snapshotSourceType === "VENUE_SNAPSHOT" && item.tournamentId === venueId
  );
  const nextVersion =
    sameVenueSnapshots.reduce((max, item) => Math.max(max, typeof item.version === "number" ? item.version : 0), 0) + 1;
  const now = new Date().toISOString();

  for (const snapshot of store.publishedCardSnapshots) {
    if (snapshot.snapshotSourceType === "VENUE_SNAPSHOT" && snapshot.tournamentId === venueId && snapshot.isActive) {
      snapshot.isActive = false;
      snapshot.updatedAt = now;
    }
  }

  const snapshot: PublishedCardSnapshot = {
    snapshotId: randomUUID(),
    tournamentId: venueId,
    snapshotSourceType: "VENUE_SNAPSHOT",
    templateType: params.templateType === "tournament" ? "tournament" : "venue",
    templateId: params.templateId,
    title,
    subtitle,
    imageId,
    image320Url,
    image640Url,
    textLayout,
    imageLayout,
    publishedAt: now,
    targetDetailUrl: `/site/venues/${venueId}`,
    deadlineSortValue: "9999-12-31",
    isPublished: true,
    version: nextVersion,
    isActive: true,
    updatedAt: now,
    publishedBy: params.publishedBy,
  };

  store.publishedCardSnapshots.push(snapshot);
  await writeStore(store);
  return { ok: true, snapshot };
}

export async function listPublishedCardSnapshots(): Promise<PublishedCardSnapshot[]> {
  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const fromTournament = store.tournamentPublishedCards
    .filter((c) => c.isPublished && c.isActive)
    .map((c) =>
      tournamentPublishedCardToPublishedSnapshot(c, templateId, tournamentDateLocationMeta(store, c.tournamentId))
    );

  const normalized = store.publishedCardSnapshots
    .map((item) => {
      const legacy = item as PublishedCardSnapshot & { cardImageUrl?: string; snapshotSourceType?: string };
      const publishedAt = item.publishedAt || new Date().toISOString();
      const snapshotSourceType = normalizeSnapshotSourceType(legacy);
      const templateType = normalizeTemplateType(legacy, snapshotSourceType);
      if (!item.image320Url && legacy.cardImageUrl) {
        return {
          ...item,
          snapshotSourceType,
          templateType,
          imageId: item.imageId || `legacy-${item.snapshotId}`,
          image320Url: legacy.cardImageUrl,
          image640Url: item.image640Url || legacy.cardImageUrl,
          version: typeof item.version === "number" ? item.version : 1,
          isActive: typeof item.isActive === "boolean" ? item.isActive : true,
          updatedAt: item.updatedAt || publishedAt,
          isPublished: typeof item.isPublished === "boolean" ? item.isPublished : true,
          publishedAt,
          deadlineSortValue:
            typeof item.deadlineSortValue === "string" && item.deadlineSortValue.trim()
              ? item.deadlineSortValue
              : "9999-12-31",
        };
      }
      return {
        ...item,
        snapshotSourceType,
        templateType,
        version: typeof item.version === "number" ? item.version : 1,
        isActive: typeof item.isActive === "boolean" ? item.isActive : true,
        updatedAt: item.updatedAt || publishedAt,
        isPublished: typeof item.isPublished === "boolean" ? item.isPublished : true,
        publishedAt,
        deadlineSortValue:
          typeof item.deadlineSortValue === "string" && item.deadlineSortValue.trim()
            ? item.deadlineSortValue
            : "9999-12-31",
      };
    })
    .filter((item) => item.isPublished);

  const activeOnly = normalized.filter((item) => item.isActive);
  activeOnly.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // 메인은 소스(대회/당구장)별 최신 active 스냅샷 1개만 사용한다.
  const latestBySource = new Map<string, PublishedCardSnapshot>();
  for (const item of fromTournament) {
    const sourceKey = getSnapshotSourceKey(item);
    if (!latestBySource.has(sourceKey)) {
      latestBySource.set(sourceKey, item);
    }
  }
  for (const item of activeOnly) {
    const sourceKey = getSnapshotSourceKey(item);
    if (!latestBySource.has(sourceKey)) {
      latestBySource.set(sourceKey, item);
    }
  }

  return Array.from(latestBySource.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 메인 홈 슬라이드에 넘길 토너먼트 게시 카드 최대 개수(슬라이드 예비 장면 포함) */
const DEFAULT_MAIN_SITE_TOURNAMENT_SLIDE_LIMIT = 4;

/**
 * 메인 홈 토너먼트 슬라이드 전용: `tournamentPublishedCards` 중 게시·활성·메인 노출 플래그가 켜진 카드만.
 * 레거시 `publishedCardSnapshots` 토너먼트 행은 사용하지 않는다(사이트에서 합성·재판단하지 않음).
 * 필터 → `updatedAt` 최신순 → 상위 limit건만 스냅샷으로 변환(전체 맵 후 자르기 없음).
 */
export async function listTournamentSnapshotsForMainSite(options?: {
  limit?: number;
}): Promise<PublishedCardSnapshot[]> {
  const limitRaw = options?.limit;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(50, Math.floor(limitRaw))
      : DEFAULT_MAIN_SITE_TOURNAMENT_SLIDE_LIMIT;

  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const rows = store.tournamentPublishedCards
    .filter((c) => c.isPublished && c.isActive && c.showOnMainSlide)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

  return rows.map((c) =>
    tournamentPublishedCardToPublishedSnapshot(c, templateId, tournamentDateLocationMeta(store, c.tournamentId))
  );
}

export async function getLatestPublishedCardSnapshotByTournamentId(
  tournamentId: string
): Promise<PublishedCardSnapshot | null> {
  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const active = store.tournamentPublishedCards
    .filter((c) => c.tournamentId === tournamentId.trim() && c.isPublished && c.isActive)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return active
    ? tournamentPublishedCardToPublishedSnapshot(
        active,
        templateId,
        tournamentDateLocationMeta(store, tournamentId)
      )
    : null;
}

export async function listCardSnapshotsByTournamentId(tournamentId: string): Promise<PublishedCardSnapshot[]> {
  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const meta = tournamentDateLocationMeta(store, tournamentId);
  return store.tournamentPublishedCards
    .filter((c) => c.tournamentId === tournamentId.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => tournamentPublishedCardToPublishedSnapshot(c, templateId, meta));
}

export async function listCardSnapshotsByVenueId(venueId: string): Promise<PublishedCardSnapshot[]> {
  const store = await readStore();
  return store.publishedCardSnapshots
    .filter((item) => normalizeSnapshotSourceType(item) === "VENUE_SNAPSHOT" && item.tournamentId === venueId)
    .map((item) => {
      const publishedAt = item.publishedAt || new Date().toISOString();
      const snapshotSourceType = normalizeSnapshotSourceType(item);
      const templateType = normalizeTemplateType(item, snapshotSourceType);
      return {
        ...item,
        snapshotSourceType,
        templateType,
        version: typeof item.version === "number" ? item.version : 1,
        isActive: typeof item.isActive === "boolean" ? item.isActive : true,
        updatedAt: item.updatedAt || publishedAt,
        isPublished: typeof item.isPublished === "boolean" ? item.isPublished : true,
        publishedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCardSnapshotById(snapshotId: string): Promise<PublishedCardSnapshot | null> {
  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const tc = store.tournamentPublishedCards.find((c) => c.snapshotId === snapshotId);
  if (tc)
    return tournamentPublishedCardToPublishedSnapshot(
      tc,
      templateId,
      tournamentDateLocationMeta(store, tc.tournamentId)
    );
  const snapshot = store.publishedCardSnapshots.find((item) => item.snapshotId === snapshotId);
  if (!snapshot) return null;
  const publishedAt = snapshot.publishedAt || new Date().toISOString();
  const snapshotSourceType = normalizeSnapshotSourceType(snapshot);
  const templateType = normalizeTemplateType(snapshot, snapshotSourceType);
  return {
    ...snapshot,
    snapshotSourceType,
    templateType,
    version: typeof snapshot.version === "number" ? snapshot.version : 1,
    isActive: typeof snapshot.isActive === "boolean" ? snapshot.isActive : true,
    updatedAt: snapshot.updatedAt || publishedAt,
    isPublished: typeof snapshot.isPublished === "boolean" ? snapshot.isPublished : true,
    publishedAt,
  };
}

export async function setCardSnapshotActive(params: {
  snapshotId: string;
  isActive: boolean;
}): Promise<{ ok: true; snapshot: PublishedCardSnapshot } | { ok: false; error: string }> {
  const store = await readStore();
  const templateId = TOURNAMENT_SNAPSHOT_TEMPLATE_ID;
  const tc = store.tournamentPublishedCards.find((c) => c.snapshotId === params.snapshotId);
  const now = new Date().toISOString();

  if (tc) {
    if (params.isActive) {
      for (const c of store.tournamentPublishedCards) {
        if (c.tournamentId === tc.tournamentId && c.snapshotId !== tc.snapshotId && c.isActive) {
          c.isActive = false;
          c.updatedAt = now;
        }
      }
    }
    tc.isActive = params.isActive;
    tc.updatedAt = now;
    tc.isPublished = true;
    const tour = store.tournaments.find((t) => t.id === tc.tournamentId);
    if (tour) {
      const badge = String(normalizeTournamentStatusBadge(tour.statusBadge));
      tc.status = badge;
      tc.showOnMainSlide = tournamentStatusEligibleForMainSlide(badge);
    }
    await writeStore(store);
    return {
      ok: true,
      snapshot: tournamentPublishedCardToPublishedSnapshot(tc, templateId, {
        date: typeof tour?.date === "string" ? tour.date : "",
        location: typeof tour?.location === "string" ? tour.location : "",
      }),
    };
  }

  const snapshot = store.publishedCardSnapshots.find((item) => item.snapshotId === params.snapshotId);
  if (!snapshot) {
    return { ok: false, error: "스냅샷을 찾을 수 없습니다." };
  }

  if (params.isActive) {
    for (const item of store.publishedCardSnapshots) {
      if (
        normalizeSnapshotSourceType(item) === normalizeSnapshotSourceType(snapshot) &&
        item.tournamentId === snapshot.tournamentId &&
        item.snapshotId !== snapshot.snapshotId &&
        item.isActive
      ) {
        item.isActive = false;
        item.updatedAt = now;
      }
    }
  }

  snapshot.isActive = params.isActive;
  snapshot.updatedAt = now;
  snapshot.isPublished = true;

  await writeStore(store);

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      templateType: normalizeTemplateType(snapshot, normalizeSnapshotSourceType(snapshot)),
      version: typeof snapshot.version === "number" ? snapshot.version : 1,
      updatedAt: snapshot.updatedAt || now,
      isPublished: typeof snapshot.isPublished === "boolean" ? snapshot.isPublished : true,
      isActive: typeof snapshot.isActive === "boolean" ? snapshot.isActive : params.isActive,
      publishedAt: snapshot.publishedAt || now,
    },
  };
}
