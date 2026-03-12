import VenueFinancePageClient from "./PageClient";

export const metadata = {
    title: "Finance | Venue Dashboard",
    description: "Financial overview, cashflow, and payout status for your venue.",
};

export default function VenueFinancePage() {
    return <VenueFinancePageClient />;
}
