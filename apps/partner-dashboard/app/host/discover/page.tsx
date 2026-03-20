import { redirect } from "next/navigation";

export default function Page() {
    redirect("/host/network?tab=discover");
}
