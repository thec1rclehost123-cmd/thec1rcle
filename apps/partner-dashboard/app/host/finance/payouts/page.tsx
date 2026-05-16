import HostPayoutsSettingsClient from "./PageClient";

export const metadata = {
    title: "Payout Settings | Finance | Host Dashboard",
    description: "Manage bank account and payout settings for your host account.",
};

export default function HostPayoutsSettingsPage() {
    return <HostPayoutsSettingsClient />;
}
