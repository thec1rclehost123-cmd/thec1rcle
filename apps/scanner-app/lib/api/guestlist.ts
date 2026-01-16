const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

interface Guest {
    id: string;
    name: string;
    ticketType: string;
    entryType: string;
    quantity: number;
    source: "online" | "door";
    status: "entered" | "not_entered";
    enteredAt?: string;
}

/**
 * Fetch guest list for an event
 */
export async function fetchGuestList(eventId: string, eventCode: string): Promise<Guest[]> {
    try {
        const response = await fetch(
            `${API_BASE}/guestlist?eventId=${eventId}&eventCode=${eventCode}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to fetch guests");
        }

        return data.guests || [];
    } catch (error: any) {
        console.error("[fetchGuestList] Error:", error);

        // For development, return mock data
        if (__DEV__) {
            return getMockGuests();
        }

        return [];
    }
}

/**
 * Mock guest data for development
 */
function getMockGuests(): Guest[] {
    const names = [
        "Arjun Sharma", "Priya Patel", "Rahul Verma", "Ananya Singh",
        "Vikram Kapoor", "Neha Gupta", "Rohan Malhotra", "Kavya Reddy",
        "Aditya Kumar", "Ishita Joshi", "Karan Mehta", "Pooja Nair",
        "Siddharth Rao", "Divya Iyer", "Nikhil Saxena", "Riya Shah",
    ];

    const ticketTypes = [
        { name: "Stag Entry", entryType: "stag" },
        { name: "Couple Entry", entryType: "couple" },
        { name: "VIP Entry", entryType: "vip" },
    ];

    return names.map((name, index) => {
        const ticket = ticketTypes[index % ticketTypes.length];
        const entered = Math.random() > 0.4;
        const isDoor = Math.random() > 0.75;

        return {
            id: `guest_${index}`,
            name,
            ticketType: ticket.name,
            entryType: ticket.entryType,
            quantity: ticket.entryType === "couple" ? 2 : 1,
            source: isDoor ? "door" : "online",
            status: entered ? "entered" : "not_entered",
            enteredAt: entered
                ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                : undefined,
        };
    });
}

/**
 * Search guests by name or phone
 */
export async function searchGuests(
    eventId: string,
    eventCode: string,
    query: string
): Promise<Guest[]> {
    const guests = await fetchGuestList(eventId, eventCode);
    const lowerQuery = query.toLowerCase();

    return guests.filter((guest) =>
        guest.name.toLowerCase().includes(lowerQuery)
    );
}
