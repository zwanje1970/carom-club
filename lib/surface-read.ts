/**
 * App(non-api) 라우트용 읽기 진입. 구현은 `platform-backing-store` 및 Firestore 모듈.
 */
import {
  getClientOrganizationByIdForPlatformFirestore,
  listApprovedClientOrganizationsFirestore,
} from "./server/firestore-client-applications";
import {
  getSiteLayoutConfig,
  getSiteVenuesBoardRows,
  getSiteCommunityConfig,
  getSiteNotice,
  listTournamentSnapshotsForMainSite,
  getMainSlideAdSettingsForSite,
  getTournamentByIdForPublicSitePage,
} from "./server/public-data-cache";
import {
  getClientDashboardPolicy,
  getClientDashboardPolicyAndOrganization,
  ensurePlatformAdminAccount,
  getSitePageBuilderDraftByPageId,
  getSitePageBuilderPublishedByPageId,
  listCommunityPostsAllPrimary,
  listCommunityPosts,
  getCommunityPostById,
  incrementCommunityPostViewCount,
  isCommunityPostAuthor,
  getSiteVenueDetailById,
  getOutlinePdfAssetById,
  getProofImageAssetById,
  isSiteImagePubliclyAccessible,
  getApplicationSummaries,
  getUserById,
  getClientStatusByUserId,
} from "./server/platform-backing-store";

export { getUserById, getClientStatusByUserId, getApplicationSummaries };
export const listApprovedClientOrganizations = listApprovedClientOrganizationsFirestore;
export const getClientOrganizationByIdForPlatform = getClientOrganizationByIdForPlatformFirestore;

export {
  getClientDashboardPolicy,
  getClientDashboardPolicyAndOrganization,
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
  getTournamentByIdForPublicSitePage,
};
