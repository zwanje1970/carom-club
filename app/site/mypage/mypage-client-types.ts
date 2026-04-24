export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  relatedTournamentId: string | null;
  createdAt: string;
  isRead: boolean;
};

export type MypageClientMenuPayload = {
  clientApplicationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
};
