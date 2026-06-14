import { redirect } from "next/navigation";

export default function Page({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const eventId = searchParams?.eventId;
    redirect(
        eventId
            ? `/venue/analytics?tab=overview&eventId=${eventId}`
            : "/venue/analytics?tab=overview"
    );
}
