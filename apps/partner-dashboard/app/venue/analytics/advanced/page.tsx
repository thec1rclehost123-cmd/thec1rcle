import { redirect } from "next/navigation";

export default function Page() {
    redirect("/venue/analytics?tab=advanced");
}
