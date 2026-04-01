import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getAdminCopy } from "@/lib/admin-copy-server";
import {
  CLIENT_CONSOLE_ORG_COOKIE,
  getAccessibleClientOrganizationsCached,
  pickActiveOrganizationId,
} from "@/lib/client-console-org.server";
import { canAccessClientDashboard } from "@/types/auth";
import { ClientConsoleShell } from "@/components/client/console/ClientConsoleShell";

type Props = {
  children: React.ReactNode;
};

/**
 * Client console shell server gate.
 * Keeps auth/session/organization loading out of `app/client/layout.tsx`.
 */
export async function ClientLayoutServer({ children }: Props) {
  const session = await getSession();
  const copy = await getAdminCopy();
  const c = copy as Record<AdminCopyKey, string>;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-bg p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-site-text">{getCopyValue(c, "client.gate.loginRequiredTitle")}</h1>
          <p className="mt-2 text-gray-600">{getCopyValue(c, "client.dashboard.loginPrompt")}</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            {getCopyValue(c, "client.gate.loginButton")}
          </Link>
        </div>
      </div>
    );
  }

  if (session.role === "ZONE_MANAGER") {
    redirect("/zone");
  }

  if (!canAccessClientDashboard(session)) {
    if (session.role !== "CLIENT_ADMIN") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-site-bg p-4">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-bold text-site-text">{getCopyValue(c, "client.gate.noClientRoleTitle")}</h1>
            <p className="mt-2 text-gray-600">{getCopyValue(c, "client.gate.noClientRoleBody")}</p>
            <Link
              href="/mypage"
              className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90"
            >
              {getCopyValue(c, "client.gate.goMypage")}
            </Link>
          </div>
        </div>
      );
    }
    redirect("/");
  }

  const organizations = await getAccessibleClientOrganizationsCached(session.id);
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
