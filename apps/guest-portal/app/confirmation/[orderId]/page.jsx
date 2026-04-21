import { notFound, redirect } from "next/navigation";
import FunnelShell from "../../../components/FunnelShell";
import OrderConfirmationDetails from "../../../components/OrderConfirmationDetails";
import { fetchCheckoutEvent, fetchOrderDetail } from "../../../lib/server/checkoutGatewayBridge.js";
import { getBearerTokenFromRequest } from "../../../lib/server/gatewayBridge.js";

export async function generateMetadata({ params }) {
    return { title: "Order Confirmed | THE C1RCLE" };
}

export default async function ConfirmationPage({ params, searchParams }) {
    const { orderId } = await params;
    const token = await getBearerTokenFromRequest(null);
    const returnPath = `/confirmation/${encodeURIComponent(orderId)}`;

    if (!token) {
        redirect(`/login?next=${encodeURIComponent(returnPath)}`);
    }

    const detail = await fetchOrderDetail(orderId, {
        token,
        cache: "no-store",
    });

    if (!detail) {
        notFound();
    }

    const { response, data } = detail;
    if (response.status === 401) {
        redirect(`/login?next=${encodeURIComponent(returnPath)}`);
    }
    if (response.status === 403 || response.status === 404) {
        notFound();
    }
    if (!response.ok) {
        notFound();
    }

    const order = data?.order || null;
    const event = data?.event || (order?.eventId ? await fetchCheckoutEvent(order.eventId, { cache: "no-store" }) : null);

    if (!order) {
        notFound();
    }

    if (order.status !== "confirmed") {
        return (
            <FunnelShell title="Payment Pending" showLogo={true} backHref="/tickets">
                <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Confirmation Pending</p>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-white">Your payment is still settling.</h1>
                    <p className="max-w-xl text-sm text-white/60">
                        We have not confirmed this order yet. Check your ticket vault in a moment. If the payment already went through,
                        this page will resolve from the gateway order record once verification completes.
                    </p>
                </div>
            </FunnelShell>
        );
    }

    if (!event) {
        notFound();
    }

    return (
        <FunnelShell title="Booking Confirmed" showLogo={true} backHref="/explore">
            <OrderConfirmationDetails
                order={order}
                event={event}
            />
        </FunnelShell>
    );
}
