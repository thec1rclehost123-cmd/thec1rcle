import { redirect } from "next/navigation";

export default function LegacyVenuesPage() {
  redirect("/hosts");
}
