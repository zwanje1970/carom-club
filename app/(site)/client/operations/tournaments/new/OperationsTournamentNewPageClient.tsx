"use client";

import { OperationsTournamentEditorClient } from "@/components/client/OperationsTournamentEditorClient";

type Props = {
  organizationId: string;
  organizationName: string;
  defaultVenueName: string;
  defaultVenueAddress: string;
  defaultVenuePhone: string;
};

export function OperationsTournamentNewPageClient({
  organizationId,
  organizationName,
  defaultVenueName,
  defaultVenueAddress,
  defaultVenuePhone,
}: Props) {
  return (
    <OperationsTournamentEditorClient
      mode="create"
      organizationId={organizationId}
      organizationName={organizationName}
      defaultVenueName={defaultVenueName}
      defaultVenueAddress={defaultVenueAddress}
      defaultVenuePhone={defaultVenuePhone}
    />
  );
}
