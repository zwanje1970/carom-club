import { redirect } from "next/navigation";

export const metadata = {
  title: "전체대회",
};

export default async function ClientOperationsPage() {
  redirect("/client/tournaments");
}
