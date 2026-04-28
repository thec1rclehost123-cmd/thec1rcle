const { listEvents } = require("./apps/guest-portal/lib/server/eventStore");

async function check() {
    try {
        const events = await listEvents({ search: "A" });
        const aEvent = events.find(e => e.title === "A");
        console.log("A Event Mapped Data:", JSON.stringify(aEvent, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
