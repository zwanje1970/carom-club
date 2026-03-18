/**
 * 이미지 업로드 공통 (CMS)
 * - lib/image-upload 재노출. 파일 구조 정리용.
 */
export {
  processUploadedImage,
  uploadToBlob,
  uploadToLocal,
  buildBlobPath,
  BLOB_TOKEN_MISSING_MESSAGE,
  BLOB_SERVICE_UNAVAILABLE_MESSAGE,
  UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE,
  isBlobConfigError,
  type ProcessedImage,
} from "@/lib/image-upload";
