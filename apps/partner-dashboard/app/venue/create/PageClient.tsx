import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const CreateEventWizardV3 = dynamic(
    () => import("@/components/wizard/CreateEventWizardV3").then(mod => mod.CreateEventWizardV3),
    { ssr: false, loading: () => <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white/20" /></div> }
);

export default function VenueCreateEventPage() {
    return <CreateEventWizardV3 role="venue" />;
}
