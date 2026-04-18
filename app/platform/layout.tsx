import GlobalHomeButton from "../components/GlobalHomeButton";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <GlobalHomeButton />
    </>
  );
}
