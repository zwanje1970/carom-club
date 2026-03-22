import { ClientConsolePlaceholder } from "@/components/client/console/ClientConsolePlaceholder";

export const metadata = {
  title: "일정 / 예약",
};

export default function ClientSchedulePage() {
  return (
    <ClientConsolePlaceholder
      title="일정 / 예약"
      description="캘린더·예약·코트/레인 배정 등(예정)"
    />
  );
}
