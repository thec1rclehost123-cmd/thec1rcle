import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("Event interaction surfaces use canonical guest API seams", () => {
  const eventRsvp = readFileSync(join(root, "components/EventRSVP.jsx"), "utf8");
  const eventEngagementApi = readFileSync(join(root, "features/events/api/eventEngagementApi.js"), "utf8");
  const queueApi = readFileSync(join(root, "features/events/api/queueApi.js"), "utf8");

  assert.equal(eventRsvp.includes("recordPromoterLinkClick"), true, "EventRSVP should delegate promoter click tracking to the event API seam");
  assert.equal(eventRsvp.includes("recordEventView"), true, "EventRSVP should delegate event-view tracking to the event API seam");
  assert.equal(eventRsvp.includes("getEventQueueStatus"), true, "EventRSVP should delegate surge checks to the event API seam");
  assert.equal(eventRsvp.includes("guestApi."), false, "EventRSVP should not talk to guestApi directly");

  for (const [relativePath, source] of [
    ["features/events/api/eventEngagementApi.js", eventEngagementApi],
    ["features/events/api/queueApi.js", queueApi],
  ]) {
    assert.equal(
      source.includes("guestApi.") || source.includes("guestApiOperationJson"),
      true,
      `${relativePath} should use the guest API seam`
    );
    assert.equal(source.includes("/api/events"), false, `${relativePath} must not call legacy /api/events routes`);
    assert.equal(source.includes("/api/waitlist"), false, `${relativePath} must not call legacy /api/waitlist`);
  }

  const waitingRoom = readFileSync(join(root, "features/events/hooks/useWaitingRoom.js"), "utf8");
  assert.equal(waitingRoom.includes("fetchQueueStatus"), true, "waiting-room hook should delegate queue polling to the queue API seam");
  assert.equal(waitingRoom.includes("joinEventQueue"), true, "waiting-room hook should delegate queue joins to the queue API seam");
  assert.equal(waitingRoom.includes("/api/events"), false, "waiting-room hook must not call legacy /api/events routes");
});

test("Event and crowd surfaces do not fall back to mock host or fake social-proof data", () => {
  const eventPage = readFileSync(join(root, "app/event/[eventId]/PageClient.jsx"), "utf8");
  const guestlist = readFileSync(join(root, "components/GuestlistModal.jsx"), "utf8");
  const eventCardUtils = readFileSync(join(root, "lib/eventCardUtils.js"), "utf8");
  const eventSelection = readFileSync(join(root, "features/events/hooks/useEventTicketSelection.js"), "utf8");
  const eventRsvp = readFileSync(join(root, "components/EventRSVP.jsx"), "utf8");
  const queueApi = readFileSync(join(root, "features/events/api/queueApi.js"), "utf8");
  const waitingRoom = readFileSync(join(root, "features/events/hooks/useWaitingRoom.js"), "utf8");

  assert.equal(eventPage.includes("getMockHostProfile"), false, "event detail must not fall back to mock host profiles");
  assert.equal(guestlist.includes("fallbackStats"), false, "guestlist modal must not invent fake guest stats");
  assert.equal(eventCardUtils.includes("fallbackGuests"), false, "event cards must not invent fake guests");
  assert.equal(eventSelection.includes("ticketId:"), false, "waitlist join must not submit legacy ticket ids");
  assert.equal(eventSelection.includes("joinEventTierWaitlist(event?.id, ticket.id)"), true, "waitlist join should submit canonical tier ids");
  assert.equal(eventSelection.includes("trackEventImpression(event?.id"), true, "event detail state should track impressions through the feature seam");
  assert.equal(eventRsvp.includes("recordPromoterLinkClick"), true, "event RSVP should track promoter clicks through the event API seam");
  assert.equal(eventRsvp.includes("recordEventView"), true, "event RSVP should record event views through the event API seam");
  assert.equal(eventRsvp.includes("getEventQueueStatus"), true, "event RSVP should query surge status through the event API seam");
  assert.equal(queueApi.includes("guestApi.events.joinQueue"), true, "queue flow should join through the guest API seam");
  assert.equal(queueApi.includes("guestApi.events.queue"), true, "queue flow should poll queue status through the guest API seam");
  assert.equal(waitingRoom.includes("userId: user?.uid"), false, "queue flow must not send client user ids into the queue join mutation");
  assert.equal(waitingRoom.includes("/login?next="), true, "queue flow should route signed-out guests into the login flow before joining");
});
