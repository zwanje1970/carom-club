import DeletedBackupClient from "./DeletedBackupClient";

export const dynamic = "force-dynamic";

export default function PlatformDataDeletedPage() {
  return (
    <main className="v3-page v3-stack">
      <DeletedBackupClient />
    </main>
  );
}
