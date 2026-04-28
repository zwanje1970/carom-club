import AdminFabServerBridge from "../components/AdminFabServerBridge";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminFabServerBridge />
    </>
  );
}
