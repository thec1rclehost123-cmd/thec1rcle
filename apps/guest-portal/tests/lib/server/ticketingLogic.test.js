import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStoredOrderTicket,
  deriveDirectTransferMetadata,
  getBundleInventoryMode,
  parseDirectTicketId,
  shouldReduceInventoryOnBundleClaim,
  shouldReduceInventoryOnBundleCreation,
} from "../../../lib/server/ticketingLogic.js";

test("buildStoredOrderTicket preserves checkout-calculated pricing and metadata", () => {
  const stored = buildStoredOrderTicket(
    {
      ticketId: "tier_ladies",
      quantity: 1,
      price: 0,
      total: 0,
      name: "Ladies Free",
      entryType: "general",
      genderRequirement: "female",
    },
    {
      id: "tier_ladies",
      name: "Ladies Free",
      price: 1200,
      genderRequirement: "female",
    },
  );

  assert.equal(stored.ticketId, "tier_ladies");
  assert.equal(stored.price, 0);
  assert.equal(stored.subtotal, 0);
  assert.equal(stored.genderRequirement, "female");
  assert.equal(stored.isCouple, false);
});

test("buildStoredOrderTicket falls back to event tier pricing when checkout payload is minimal", () => {
  const stored = buildStoredOrderTicket(
    {
      ticketId: "tier_vip",
      quantity: 2,
    },
    {
      id: "tier_vip",
      name: "VIP",
      price: 2500,
      entryType: "general",
    },
  );

  assert.equal(stored.price, 2500);
  assert.equal(stored.subtotal, 5000);
  assert.equal(stored.entryType, "general");
});

test("RSVP bundles are claim-based while paid checkouts stay precommitted", () => {
  assert.equal(getBundleInventoryMode({ isRSVP: true }), "claim_based");
  assert.equal(getBundleInventoryMode({ isRSVP: false }), "precommitted");
  assert.equal(shouldReduceInventoryOnBundleCreation("claim_based", true), true);
  assert.equal(shouldReduceInventoryOnBundleCreation("precommitted", true), false);
  assert.equal(shouldReduceInventoryOnBundleClaim("claim_based"), true);
  assert.equal(shouldReduceInventoryOnBundleClaim("precommitted"), false);
});

test("parseDirectTicketId extracts order, tier, and slot index", () => {
  assert.deepEqual(parseDirectTicketId("ORD-abc123-tier_vip-2"), {
    orderId: "ORD-abc123",
    tierId: "tier_vip",
    slotIndex: 2,
  });
});

test("deriveDirectTransferMetadata keeps gender restrictions for direct transfers", () => {
  const metadata = deriveDirectTransferMetadata(
    "ORD-abc123-tier_ladies-1",
    {
      id: "ORD-abc123",
      tickets: [
        {
          ticketId: "tier_ladies",
          name: "Ladies Free",
          entryType: "general",
          genderRequirement: "female",
        },
      ],
    },
    {
      tickets: [
        {
          id: "tier_ladies",
          name: "Ladies Free",
          genderRequirement: "female",
        },
      ],
    },
  );

  assert.deepEqual(metadata, {
    orderId: "ORD-abc123",
    tierId: "tier_ladies",
    slotIndex: 1,
    ticketType: "Ladies Free",
    requiredGender: "female",
  });
});

test("deriveDirectTransferMetadata rejects couple tickets from the generic transfer flow", () => {
  assert.throws(
    () =>
      deriveDirectTransferMetadata("ORD-abc123-tier_couple-1", {
        id: "ORD-abc123",
        tickets: [
          {
            ticketId: "tier_couple",
            name: "Couple Entry",
            entryType: "couple",
          },
        ],
      }),
    /couple ticket flow/i,
  );
});
