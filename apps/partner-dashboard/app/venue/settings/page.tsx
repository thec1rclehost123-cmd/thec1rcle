import { Suspense } from "react";
import SettingsHub from "./SettingsHub";

export const metadata = { title: "Settings — Venue" };

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsHub />
        </Suspense>
    );
}
