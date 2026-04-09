import { getSession } from "@/lib/auth";
import { getAdminCopy } from "@/lib/admin-copy-server";
import type { AdminCopyKey } from "@/lib/admin-copy";
import {
  CLIENT_CONSOLE_ORG_COOKIE,
  getAccessibleClientOrganizationsCached,
  pickActiveOrganizationId,
} from "@/lib/client-console-org.server";
import { ClientConsoleShell } from "@/components/client/console/ClientConsoleShell";

type Props = {
  children: React.ReactNode;
};

/**
 * Client console shell server gate.
 * Keeps auth/session/organization loading out of `app/client/layout.tsx`.
 */
export async function ClientLayoutServer({ children }: Props) {
  const copyPromise = getAdminCopy();
  const session = await getSession();
  if (!session) return null;

  const [copy, organizations] = await Promise.all([
    copyPromise,
    getAccessibleClientOrganizationsCached(session.id),
  ]);
  const c = copy as Record<AdminCopyKey, string>;
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(CLIENT_CONSOLE_ORG_COOKIE)?.value ?? null;
  const activeOrganizationId = pickActiveOrganizationId(organizations, preferredOrgId);

  return (
    <ClientConsoleShell
      copy={copy}
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
    >
      {children}
    </ClientConsoleShell>
  );
}
