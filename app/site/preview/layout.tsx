import PreviewSessionMarker from "./preview-session";

export default function SitePreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PreviewSessionMarker />
      {children}
    </>
  );
}
