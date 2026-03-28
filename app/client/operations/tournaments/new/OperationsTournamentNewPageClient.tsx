"use client";

import { OperationsTournamentEditorClient } from "@/components/client/OperationsTournamentEditorClient";

type Props = {
  organizationId: string;
  organizationName: string;
};

export function OperationsTournamentNewPageClient({
  organizationId,
  organizationName,
}: Props) {
  return (
    <OperationsTournamentEditorClient
      mode="create"
      organizationId={organizationId}
      organizationName={organizationName}
    />
  );
}
