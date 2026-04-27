/**
 * App(non-api) 라우트용 읽기 진입. 구현은 `platform-backing-store` 및 Firestore 모듈.
 */
import { firestoreGetUserById } from "./server/firestore-users";
import {
  getApplicationSummariesFirestore,
  getClientOrganizationByIdForPlatformFirestore,
  getClientStatusByUserIdFirestore,
  listApprovedClientOrganizationsFirestore,
} from "./server/firestore-client-applications";
import {
  getClientDashboardPolicy,
  ensurePlatformAdminAccount,
  getSiteLayoutConfig,
  getSiteNotice,
  getSitePageBuilderDraftByPageId,
  getSitePageBuilderPublishedByPageId,
  listTournamentSnapshotsForMainSite,
  getSiteCommunityConfig,
  listCommunityPostsAllPrimary,
  listCommunityPosts,
  getCommunityPostById,
  incrementCommunityPostViewCount,
  isCommunityPostAuthor,
  getSiteVenuesBoardRows,
  getSiteVenueDetailById,
  getOutlinePdfAssetById,
  getProofImageAssetById,
  isSiteImagePubliclyAccessible,
  getMainSlideAdSettingsForSite,
} from "./server/platform-backing-store";

export const getUserById = firestoreGetUserById;
export const getClientStatusByUserId = getClientStatusByUserIdFirestore;
export const getApplicationSummaries = getApplicationSummariesFirestore;
export const listApprovedClientOrganizations = listApprovedClientOrganizationsFirestore;
export const getClientOrganizationByIdForPlatform = getClientOrganizationByIdForPlatformFirestore;

export {
  getClientDashboardPolicy,
  ensurePlatformAdminAccount,
  getSiteLayoutConfig,
  getSiteNotice,
  getSitePageBuilderDraftByPageId,
  getSitePageBuilderPublishedByPageId,
  listTournamentSnapshotsForMainSite,
  getSiteCommunityConfig,
  listCommunityPostsAllPrimary,
  listCommunityPosts,
  getCommunityPostById,
  incrementCommunityPostViewCount,
  isCommunityPostAuthor,
  getSiteVenuesBoardRows,
  getSiteVenueDetailById,
  getOutlinePdfAssetById,
  getProofImageAssetById,
  isSiteImagePubliclyAccessible,
  getMainSlideAdSettingsForSite,
};
