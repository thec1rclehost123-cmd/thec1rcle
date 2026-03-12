import VenueFinanceLedgerClient from "./PageClient";

export const metadata = {
    title: "Ledger | Finance | Venue Dashboard",
    description: "Full transaction history and financial ledger for your venue.",
};

export default function VenueFinanceLedgerPage() {
    return <VenueFinanceLedgerClient />;
}
