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
  type ProcessedImage,
} from "@/lib/image-upload";
