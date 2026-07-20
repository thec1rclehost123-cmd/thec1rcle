import { useCartStore } from "../../store/cartStore";
import { validatePromoCode } from "../../lib/api";

jest.mock("../../lib/api", () => ({
    validatePromoCode: jest.fn(),
}));

const ticket = {
    id: "general",
    name: "General Entry",
    price: 1200,
    quantity: 1,
    remaining: 20,
    soldPercent: 10,
};

describe("cartStore checkout state", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useCartStore.getState().clearCart();
    });

    it("stores cart state in AsyncStorage-backed Zustand without SecureStore", () => {
        useCartStore.getState().addItem({
            eventId: "event_1",
            eventTitle: "Neon Night",
            eventDate: "2026-06-20T20:00:00.000Z",
            eventVenue: "EPITOME",
            tier: ticket,
            quantity: 2,
        });

        expect(useCartStore.getState().items).toHaveLength(1);
        expect(useCartStore.getState().getCheckoutItems()).toEqual([{ tierId: "general", quantity: 2 }]);
    });

    it("validates promo codes through the backend API and stores returned discount metadata", async () => {
        (validatePromoCode as jest.Mock).mockResolvedValueOnce({
            valid: true,
            discountAmount: 240,
            label: "Host invite",
        });
        useCartStore.getState().addItem({
            eventId: "event_1",
            eventTitle: "Neon Night",
            eventDate: "2026-06-20T20:00:00.000Z",
            eventVenue: "EPITOME",
            tier: ticket,
            quantity: 2,
        });

        const result = await useCartStore.getState().applyPromoCode("host20", "event_1");

        expect(result).toEqual({ success: true });
        expect(validatePromoCode).toHaveBeenCalledWith({
            eventId: "event_1",
            code: "HOST20",
            items: [{ tierId: "general", quantity: 2 }],
        });
        expect(useCartStore.getState().promo).toEqual({
            code: "HOST20",
            discountAmount: 240,
            discountPercent: 10,
            label: "Host invite",
        });
    });

    it("clears stale reservations when cart quantities change", () => {
        useCartStore.getState().addItem({
            eventId: "event_1",
            eventTitle: "Neon Night",
            eventDate: "2026-06-20T20:00:00.000Z",
            eventVenue: "EPITOME",
            tier: ticket,
            quantity: 1,
        });
        useCartStore.getState().setPendingReservation({
            reservationId: "res_1",
            eventId: "event_1",
            eventTitle: "Neon Night",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            items: [{ tierId: "general", quantity: 1 }],
        });

        useCartStore.getState().updateQuantity("event_1", "general", 2);

        expect(useCartStore.getState().pendingReservation).toBeNull();
        expect(useCartStore.getState().pendingPaymentOrderId).toBeNull();
    });
});
