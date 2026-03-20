import { Suspense } from "react";
import FinanceHub from "./FinanceHub";

export const metadata = {
    title: "Finance | Venue Dashboard",
    description: "Financial overview, cashflow, payouts and reports for your venue.",
};

export default function VenueFinancePage() {
    return (
        <Suspense>
            <FinanceHub />
        </Suspense>
    );
}
