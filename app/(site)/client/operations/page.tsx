import { redirect } from "next/navigation";

export const metadata = {
  title: "대회관리",
};

export default async function ClientOperationsPage() {
  redirect("/client/tournaments");
}
