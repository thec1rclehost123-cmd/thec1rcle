import { getApiClient } from "./lib/server/apiClient.js";
import { discoverPartners } from "./lib/server/promoterConnectionStore.js";

async function run() {
  try {
    const p = await discoverPartners({ type: "host", limit: 30 }, "fake-token");
    console.log("Found partners:", p);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
