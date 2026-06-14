import { describe, expect, it } from "vitest";

import { cn } from "./utils.js";

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("px-2", false, null, "text-sm", { hidden: false, block: true })).toBe("px-2 text-sm block");
  });

  it("deduplicates conflicting tailwind utilities by keeping the last one", () => {
    expect(cn("px-2 py-1", "px-4", "py-3")).toBe("px-4 py-3");
  });
});
