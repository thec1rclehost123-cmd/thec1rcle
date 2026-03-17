import { StaffProfileEditorClient } from "./PageClient";

export const metadata = { title: "Edit Access Profile — Venue" };

export default function ProfileEditorPage({
    params,
}: {
    params: { profileId: string };
}) {
    return <StaffProfileEditorClient profileId={params.profileId} />;
}
