import Link from "next/link";
import { CheckCircle2, ArrowRight, Calendar, MapPin, Ticket } from "lucide-react";
import { getEvent } from "../../../lib/server/eventStore";
import { getOrderById } from "../../../lib/server/orderStore";

export default async function ConfirmationPage({ params, searchParams }) {
    const { orderId } = params;
    const eventId = searchParams.eventId;

    let event = null;
    let order = null;

    // Fetch order details
    try {
        order = await getOrderById(orderId);
    } catch (error) {
        console.error("Failed to fetch order:", error);
    }

    // Fetch event details (from order or searchParams)
    const finalEventId = order?.eventId || eventId;
    if (finalEventId) {
        event = await getEvent(finalEventId);
    }

    return (
        <div className="min-h-screen flex items-center justify-center text-white p-4">
            <div className="max-w-2xl w-full space-y-8 text-center">

                <div className="flex justify-center">
                    <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
                        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-display uppercase tracking-wider">You're In!</h1>
                    <p className="text-lg text-white/60">Your tickets have been confirmed.</p>
                    <div className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-mono text-white/60">
                        Order ID: {orderId}
                    </div>
                </div>

                {event && (
                    <div className="glass-panel p-6 rounded-[32px] border border-white/10 bg-white/5 max-w-md mx-auto text-left hover:bg-white/10 transition-colors duration-300">
                        <div className="flex gap-4 items-start">
                            <div className="h-20 w-20 rounded-2xl bg-white/10 overflow-hidden flex-shrink-0 relative">
                                <img src={event.image} alt={event.title} className="object-cover h-full w-full" />
                            </div>
                            <div>
                                <h3 className="font-display uppercase tracking-wider text-lg">{event.title}</h3>
                                <div className="flex items-center gap-2 text-white/60 text-sm mt-2">
                                    <Calendar className="w-3 h-3" />
                                    <span>{event.date} • {event.time}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{event.location}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {order && (
                    <div className="glass-panel p-6 rounded-[32px] border border-white/10 bg-white/5 max-w-md mx-auto">
                        <div className="flex items-center gap-2 mb-4">
                            <Ticket className="w-4 h-4 text-white/60" />
                            <h3 className="text-xs uppercase tracking-[0.4em] text-white/40">Order Summary</h3>
                        </div>

                        <div className="space-y-3 mb-4">
                            {order.tickets.map((ticket, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <div>
                                        <p className="text-white font-medium">{ticket.name}</p>
                                        <p className="text-white/50 text-xs">Qty: {ticket.quantity}</p>
                                    </div>
                                    <p className="text-white font-semibold">₹{ticket.subtotal.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="h-px bg-white/10 mb-4" />

                        <div className="flex justify-between items-center">
                            <p className="text-white/60 text-sm">Total Paid</p>
                            <p className="text-white text-xl font-bold">₹{order.totalAmount.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    <Link
                        href="/explore"
                        className="w-full sm:w-auto px-8 py-3 rounded-full bg-white text-black font-bold uppercase tracking-widest hover:bg-white/90 transition-colors"
                    >
                        Explore More
                    </Link>
                    <Link
                        href={eventId ? `/event/${eventId}` : "/explore"}
                        className="w-full sm:w-auto px-8 py-3 rounded-full border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                        View Ticket
                    </Link>
                </div>

            </div>
        </div>
    );
}
