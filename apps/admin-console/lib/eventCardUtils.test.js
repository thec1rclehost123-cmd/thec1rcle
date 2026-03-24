import { describe, expect, it } from "vitest";

import { formatEventTime, getEventHref, getGuestInitials, getGuestList } from "./eventCardUtils.js";

describe("eventCardUtils", () => {
  describe("getGuestList", () => {
    it("normalizes guest values and respects the requested limit", () => {
      const event = {
        guests: [
          "Anaya Kapoor",
          { name: "Rohit Sharma" },
          { handle: "@mira" },
          null,
          { unknown: true },
        ],
      };

      expect(getGuestList(event, 2)).toEqual(["Anaya Kapoor", "Rohit Sharma"]);
      expect(getGuestList(event, 4)).toEqual(["Anaya Kapoor", "Rohit Sharma", "@mira"]);
    });

    it("falls back to default guests when the event has no usable guest list", () => {
      expect(getGuestList({}, 3)).toEqual(["Anaya", "Rohit", "Mira"]);
      expect(getGuestList({ guests: [null, "", { unknown: true }] }, 2)).toEqual(["Anaya", "Rohit"]);
    });
  });

  describe("getGuestInitials", () => {
    it("returns initials for multi-word names", () => {
      expect(getGuestInitials("Neel Rao")).toBe("NR");
    });

    it("uses the default initials for empty input", () => {
      expect(getGuestInitials("   ")).toBe("GL");
      expect(getGuestInitials()).toBe("GL");
    });
  });

  describe("formatEventTime", () => {
    it("prefers an explicit event time value", () => {
      expect(formatEventTime({ time: "10:30 PM" })).toBe("10:30 PM");
    });

    it("formats valid start times and ignores invalid values", () => {
      const startTime = "2026-03-23T17:35:00.000Z";
      const expected = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(startTime));

      expect(formatEventTime({ startTime })).toBe(expected);
      expect(formatEventTime({ startDateTime: "not-a-date" })).toBe("");
      expect(formatEventTime({})).toBe("");
    });
  });

  describe("getEventHref", () => {
    it("prefers slug, then id, then handle, before the generic event route", () => {
      expect(getEventHref({ slug: "midnight-run", id: "evt_1", handle: "mr" })).toBe("/event/midnight-run");
      expect(getEventHref({ id: "evt_1", handle: "mr" })).toBe("/event/evt_1");
      expect(getEventHref({ handle: "mr" })).toBe("/event/mr");
      expect(getEventHref({})).toBe("/event");
    });
  });
});
