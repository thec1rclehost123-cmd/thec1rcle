import PromoterFinancePageClient from "@/app/promoter/finance/PageClient";

export const metadata = {
    title: "Finance | Promoter Dashboard",
    description: "Your earnings, commissions, and payout overview.",
};

export default function PromoterFinancePage() {
    return <PromoterFinancePageClient />;
}
