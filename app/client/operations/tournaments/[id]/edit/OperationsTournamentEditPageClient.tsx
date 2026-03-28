"use client";

import { OperationsTournamentEditorClient } from "@/components/client/OperationsTournamentEditorClient";

type Props = {
  tournamentId: string;
  organizationId: string;
  organizationName: string;
};

export function OperationsTournamentEditPageClient({
  tournamentId,
  organizationId,
  organizationName,
}: Props) {
  return (
    <OperationsTournamentEditorClient
      mode="edit"
      tournamentId={tournamentId}
      organizationId={organizationId}
      organizationName={organizationName}
    />
  );
}
