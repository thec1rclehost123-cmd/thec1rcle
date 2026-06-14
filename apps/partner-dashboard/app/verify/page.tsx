import { redirect } from "next/navigation";

// Verification Hub has been removed — KYC is now collected during the onboarding wizard.
export default function VerifyPage() {
    redirect("/");
}
