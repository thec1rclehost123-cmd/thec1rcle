import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("hot guest portal screens delegate orchestration to feature hooks and adapters", () => {
  const checkout = read("components/CheckoutContainer.jsx");
  const eventDetail = read("components/EventDetail.jsx");
  const reservation = read("components/venue/ReservationCalendarModal.jsx");
  const login = read("app/login/PageClient.jsx");
  const tickets = read("app/tickets/PageClient.jsx");
  const profile = read("components/EditProfileModal.jsx");
  const appPage = read("app/app/page.js");
  const queuePage = read("app/event/[eventId]/queue/PageClient.jsx");
  const promoterHandlePage = read("app/[handle]/PageClient.jsx");
  const explorePage = read("components/ExploreClient.jsx");

  assert.equal(checkout.includes("useCheckoutSession"), true, "CheckoutContainer should consume the checkout session hook");
  assert.equal(checkout.includes("guestApi"), false, "CheckoutContainer should not talk to guestApi directly");
  assert.equal(checkout.includes("localStorage"), false, "CheckoutContainer should not own reservation storage");
  assert.equal(checkout.includes("window.Razorpay"), false, "CheckoutContainer should not own the Razorpay runtime");

  assert.equal(eventDetail.includes("useEventTicketSelection"), true, "EventDetail should consume the event ticket selection hook");
  assert.equal(eventDetail.includes("guestApi"), false, "EventDetail should not talk to guestApi directly");
  assert.equal(eventDetail.includes("guestApiOperationJson"), false, "EventDetail should not invoke raw operations directly");

  assert.equal(reservation.includes("useVenueReservationFlow"), true, "Reservation modal should consume the venue reservation flow hook");
  assert.equal(reservation.includes("guestApi"), false, "Reservation modal should not talk to guestApi directly");
  assert.equal(reservation.includes("totalPrice"), false, "Reservation modal should not compute frontend totals");

  assert.equal(login.includes("useLoginFlow"), true, "Login page should delegate auth orchestration to a feature hook");
  assert.equal(login.includes("useOnboardingDraft"), false, "Login page should not own onboarding draft orchestration directly");
  assert.equal(login.includes("checkGuestEmail"), false, "Login page should not call auth adapters directly");
  assert.equal(login.includes("authService"), false, "Login page should not own raw OTP transport");
  assert.equal(login.includes("sessionStorage"), false, "Login page should not own sessionStorage directly");

  assert.equal(tickets.includes("usePendingReservationRecovery"), true, "Tickets page should delegate reservation recovery");
  assert.equal(tickets.includes("useCancelOrderBridge"), true, "Tickets page should delegate cancel-order bridge state");
  assert.equal(tickets.includes("TicketCarouselShowcase"), true, "Tickets page should delegate the guest carousel to a pure component");
  assert.equal(tickets.includes("window.__cancelOrderData"), false, "Tickets page should not touch the global cancel-order bridge directly");
  assert.equal(tickets.includes("localStorage"), false, "Tickets page should not own reservation recovery storage");

  assert.equal(profile.includes("useEditProfileFlow"), true, "Edit profile should delegate mutation orchestration to a feature hook");
  assert.equal(profile.includes("useAvatarCropper"), false, "Edit profile should not own crop/upload orchestration directly");
  assert.equal(profile.includes("AvatarCropDialog"), true, "Edit profile should delegate cropper rendering to a component");
  assert.equal(profile.includes("guestApi.profiles.avatar"), false, "Edit profile should not upload avatars directly");

  assert.equal(appPage.includes("useAppWaitlist"), false, "App marketing route should stay thin");
  assert.equal(appPage.includes("AppMarketingExperience"), true, "App marketing route should delegate to the feature experience component");
  assert.equal(appPage.includes("guestApi.waitlist.join"), false, "App marketing page should not talk to the guest API directly");

  assert.equal(queuePage.includes("useWaitingRoom"), true, "Queue page should consume the waiting-room hook");
  assert.equal(queuePage.includes("guestApi"), false, "Queue page should not talk to guestApi directly");
  assert.equal(queuePage.includes("sessionStorage"), false, "Queue page should not own queue admission storage");

  assert.equal(promoterHandlePage.includes("usePromoterProfile"), true, "Promoter handle page should consume the promoter profile hook");
  assert.equal(promoterHandlePage.includes("PromoterHandleView"), true, "Promoter handle page should delegate rendering to a pure view");
  assert.equal(promoterHandlePage.includes("fetchPromoterByUsername"), false, "Promoter handle page should not fetch directly");

  assert.equal(explorePage.includes("useExplorePageState"), true, "Explore page should delegate discovery orchestration to a feature hook");
  assert.equal(explorePage.includes("fetchPublicEvents"), false, "Explore page should not fetch trending data directly");
  assert.equal(explorePage.includes("localStorage"), false, "Explore page should not own local storage directly");
});

test("pure extracted guest portal view components stay free of runtime orchestration imports", () => {
  const ticketCarousel = read("features/tickets/components/TicketCarouselShowcase.jsx");
  const avatarDialog = read("features/profile/components/AvatarCropDialog.jsx");
  const promoterHandleView = read("features/discovery/components/PromoterHandleView.jsx");
  const appWaitlistSection = read("features/app-download/components/AppWaitlistSection.jsx");

  for (const [relativePath, source] of [
    ["features/tickets/components/TicketCarouselShowcase.jsx", ticketCarousel],
    ["features/profile/components/AvatarCropDialog.jsx", avatarDialog],
    ["features/discovery/components/PromoterHandleView.jsx", promoterHandleView],
    ["features/app-download/components/AppWaitlistSection.jsx", appWaitlistSection],
  ]) {
    assert.equal(source.includes("guestApi"), false, `${relativePath} must stay presentation-only`);
    assert.equal(source.includes("useAuth"), false, `${relativePath} must not reach into auth state`);
    assert.equal(source.includes("localStorage"), false, `${relativePath} must not use browser storage`);
    assert.equal(source.includes("sessionStorage"), false, `${relativePath} must not use browser storage`);
    assert.equal(source.includes("window.Razorpay"), false, `${relativePath} must not touch SDK runtimes`);
  }
});

test("event detail business helpers no longer hide ticket availability rules in generic utils", () => {
  const eventUtils = read("features/events/eventDetailUtils.js");
  const eventSelectionHook = read("features/events/hooks/useEventTicketSelection.js");
  const exploreModel = read("features/discovery/exploreModel.js");
  const venueReservationHook = read("features/venues/hooks/useVenueReservationFlow.js");

  assert.equal(eventUtils.includes("export function getAvailability"), false, "eventDetailUtils should not expose ticket availability rules");
  assert.equal(eventUtils.includes("export function getTierLimit"), false, "eventDetailUtils should not expose ticket limit rules");
  assert.equal(eventSelectionHook.includes("function getAvailability"), true, "ticket availability logic should stay scoped to the event selection seam");
  assert.equal(eventSelectionHook.includes("function getTierLimit"), true, "ticket limit logic should stay scoped to the event selection seam");
  assert.equal(exploreModel.includes("event.tickets.reduce"), false, "exploreModel should not derive discovery pricing from raw tier arrays");
  assert.equal(venueReservationHook.includes("selectedTier?.price * guests"), false, "venue reservation hook should not derive totals from tier price times guest count");
});
