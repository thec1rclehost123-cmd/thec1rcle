"use client";

import { DetailedBreakdown } from "./components/DetailedBreakdown";

interface PromoterStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
}

export function PromoterStep({ formData }: PromoterStepProps) {
    return <DetailedBreakdown formData={formData} />;
}
