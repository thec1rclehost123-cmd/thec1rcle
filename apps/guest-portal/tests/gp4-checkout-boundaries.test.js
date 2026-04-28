import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

test("Checkout and payment client surfaces use direct /api/v1 calls", () => {
  const files = [
    "components/CheckoutContainer.jsx",
    "components/CancelOrderModal.jsx",
    "components/CoverTicketCard.jsx",
    "app/tickets/PageClient.jsx",
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.equal(source.includes("/api/checkout/"), false, `${relativePath} must not call /api/checkout/*`);
    assert.equal(source.includes("/api/payments"), false, `${relativePath} must not call /api/payments`);
    assert.equal(source.includes("/api/orders"), false, `${relativePath} must not call /api/orders`);
    assert.equal(source.includes("/api/tickets/cover-wallet"), false, `${relativePath} must not call /api/tickets/cover-wallet`);
  }
});

test("Checkout payment surfaces stay on typed guest API helpers", () => {
  const checkout = readFileSync(join(root, "components/CheckoutContainer.jsx"), "utf8");
  const checkoutHook = readFileSync(join(root, "features/checkout/hooks/useCheckoutSession.js"), "utf8");
  const checkoutApi = readFileSync(join(root, "features/checkout/api/checkoutApi.js"), "utf8");
  const checkoutModel = readFileSync(join(root, "features/checkout/utils/checkoutSessionModel.js"), "utf8");
  const cancelOrder = readFileSync(join(root, "components/CancelOrderModal.jsx"), "utf8");

  assert.equal(checkout.includes("useCheckoutSession"), true, "CheckoutContainer must delegate orchestration to the checkout session hook");
  assert.equal(checkout.includes("guestApi.checkout.calculate"), false, "CheckoutContainer should not talk to guestApi directly once atomized");
  assert.equal(checkout.includes("guestApi.checkout.promo"), false, "CheckoutContainer should not validate promos directly once atomized");
  assert.equal(checkout.includes("guestApi.checkout.reserve"), false, "CheckoutContainer should not reserve directly once atomized");
  assert.equal(checkout.includes("guestApi.checkout.initiate"), false, "CheckoutContainer should not initiate directly once atomized");
  assert.equal(checkout.includes("guestApi.payments.verify"), false, "CheckoutContainer should not verify payments directly once atomized");
  assert.equal(checkoutHook.includes("calculateCheckout("), true, "checkout session hook must calculate through the checkout adapter");
  assert.equal(checkoutHook.includes("validateCheckoutPromo("), true, "checkout session hook must validate promos through the checkout adapter");
  assert.equal(checkoutHook.includes("reserveCheckoutInventory("), true, "checkout session hook must reserve through the checkout adapter");
  assert.equal(checkoutHook.includes("initiateCheckout("), true, "checkout session hook must initiate through the checkout adapter");
  assert.equal(checkoutHook.includes('from "../utils/checkoutSessionModel"'), true, "checkout session hook should delegate orchestration decisions to a feature model");
  assert.equal(checkoutHook.includes("buildCheckoutQuotePayload"), true, "checkout session hook should build quote requests through the checkout model");
  assert.equal(checkoutHook.includes("deriveCheckoutConstraints"), true, "checkout session hook should derive CTA constraints through the checkout model");
  assert.equal(checkoutHook.includes("applyTicketQuantityDelta"), true, "checkout session hook should derive quantity changes through the checkout model");
  assert.equal(checkoutHook.includes("buildReserveCheckoutPayload"), true, "checkout session hook should build reservation payloads through the checkout model");
  assert.equal(checkoutHook.includes("buildInitiateCheckoutPayload"), true, "checkout session hook should build initiation payloads through the checkout model");
  assert.equal(checkoutApi.includes("guestApi.checkout.calculate"), true, "checkout API adapter must call the typed guest API for quote calculation");
  assert.equal(checkoutApi.includes("guestApi.checkout.promo"), true, "checkout API adapter must call the typed guest API for promo validation");
  assert.equal(checkoutApi.includes("guestApi.checkout.reserve"), true, "checkout API adapter must call the typed guest API for reservation");
  assert.equal(checkoutApi.includes("guestApi.checkout.initiate"), true, "checkout API adapter must call the typed guest API for initiation");
  assert.equal(checkoutApi.includes("guestApi.payments.verify"), true, "checkout API adapter must call the typed guest API for payment verification");
  assert.equal(checkoutModel.includes("shouldUseSavedReservationQuote"), true, "checkout session model must own saved reservation reuse decisions");
  assert.equal(checkoutModel.includes("buildCheckoutQuotePayload"), true, "checkout session model must own quote payload construction");
  assert.equal(checkoutModel.includes("buildGuestLoginRedirect"), true, "checkout session model must own guest login redirect construction");
  assert.equal(checkoutHook.includes("persistReservation(data.reservation || cartReservation"), true, "checkout session hook must refresh saved reservation state from the server");
  assert.equal(checkoutHook.includes("clearPersistedReservation();"), true, "checkout session hook should clear stale reservations through the reservation storage seam");
  assert.equal(checkout.includes("disabled={!canSubmitCheckout}"), true, "CheckoutContainer must gate checkout submission on the authoritative quote state");
  assert.equal(checkoutHook.includes("const [isQuoteSyncing, setIsQuoteSyncing] = useState(false);"), true, "checkout session hook must track authoritative quote synchronization state");
  assert.equal(checkoutHook.includes("if (!quoteReady || isQuoteSyncing) return;"), true, "checkout session hook must not mutate ticket quantities before the backend quote is ready");
  assert.equal(checkout.includes("Syncing live availability..."), true, "CheckoutContainer must show a live availability sync state instead of guessing locally");
  assert.equal(checkout.includes("useLiveCheckoutInventory"), false, "CheckoutContainer must not depend on client-owned live inventory hooks");
  assert.equal(checkout.includes("_liveAvailable"), false, "CheckoutContainer must not rely on local live-availability fallbacks");
  assert.equal(checkout.includes("gatewayFetch("), false, "CheckoutContainer must not bypass the typed guest API seam");
  assert.equal(checkout.includes("localStorage"), false, "CheckoutContainer should not own reservation persistence");
  assert.equal(checkout.includes("window.Razorpay"), false, "CheckoutContainer should not own the Razorpay runtime");
  assert.equal(checkout.includes("subtotal: t.price * t.quantity"), false, "CheckoutContainer promo validation must not send client-derived subtotals");
  assert.equal(checkout.includes("price: t.price"), false, "CheckoutContainer promo validation must not send client-derived prices");
  assert.equal(checkout.includes("order_mock_"), false, "CheckoutContainer should not own Razorpay mock-order rejection");
  assert.equal(readFileSync(join(root, "features/checkout/hooks/useRazorpayCheckout.js"), "utf8").includes("order_mock_"), true, "Razorpay hook should reject mock Razorpay orders before launch");
  assert.equal(checkout.includes("pay_mock_"), false, "CheckoutContainer must not generate mock payment ids");
  assert.equal(checkout.includes("sig_mock_"), false, "CheckoutContainer must not generate mock payment signatures");
  assert.equal(checkoutHook.includes("setCheckoutQuote(data.quote || null)"), true, "checkout session hook must persist the authoritative checkout quote");
  assert.equal(checkoutHook.includes("quoteTierConstraints"), true, "checkout session hook must consume quote tier constraints for UI limits");

  assert.equal(
    existsSync(join(root, "components/RazorpayCheckout.jsx")),
    false,
    "Duplicate RazorpayCheckout component should be deleted once CheckoutContainer owns the runtime payment flow"
  );

  assert.equal(cancelOrder.includes("getOrderCancelEligibility"), true, "CancelOrderModal must check cancellation eligibility through the order feature seam");
  assert.equal(cancelOrder.includes("cancelGuestOrder"), true, "CancelOrderModal must cancel orders through the order feature seam");
  assert.equal(cancelOrder.includes("guestApi.orders.cancelEligibility"), false, "CancelOrderModal should not call guestApi directly once atomized");
  assert.equal(cancelOrder.includes("guestApi.orders.cancel"), false, "CancelOrderModal should not call guestApi directly once atomized");
  assert.equal(cancelOrder.includes("gatewayJson("), false, "CancelOrderModal must not bypass the typed guest API seam");

  assert.equal(
    existsSync(join(root, "features/checkout/useLiveCheckoutInventory.js")),
    false,
    "Legacy useLiveCheckoutInventory.js must be deleted — backend quote is now the single inventory truth"
  );
});
