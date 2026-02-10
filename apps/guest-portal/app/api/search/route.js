import { NextResponse } from "next/server";
import {
    searchEvents,
    searchVenues,
    getSearchSuggestions
} from "@c1rcle/core/search";

/**
 * GET /api/search
 * 
 * Universal search endpoint for the Guest Portal
 * Supports events, venues, and autocomplete suggestions
 * 
 * Query Parameters:
 * - q: Search query (required)
 * - type: "events" | "venues" | "suggestions" (default: "events")
 * - city: Filter by city
 * - genres: Comma-separated genres
 * - dateFrom: Start date filter (ISO string)
 * - dateTo: End date filter (ISO string)
 * - priceMax: Maximum price filter
 * - limit: Results per page (default: 20, max: 100)
 * - offset: Pagination offset
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "events";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    try {
        // Autocomplete suggestions
        if (type === "suggestions") {
            if (!query || query.length < 2) {
                return NextResponse.json({ suggestions: [] });
            }

            const suggestions = await getSearchSuggestions(query, 5);
            return NextResponse.json({ suggestions });
        }

        // Venue search
        if (type === "venues") {
            const filters = {};
            if (searchParams.get("city")) filters.city = searchParams.get("city");
            if (searchParams.get("venueType")) filters.venueType = searchParams.get("venueType");
            if (searchParams.get("verified") === "true") filters.isVerified = true;

            const result = await searchVenues(query, { filters, limit, offset });

            return NextResponse.json({
                type: "venues",
                query,
                ...result,
            });
        }

        // Event search (default)
        const filters = {
            status: "published", // Only show published events
        };

        if (searchParams.get("city")) filters.venueCity = searchParams.get("city");
        if (searchParams.get("genres")) {
            filters.genres = searchParams.get("genres").split(",").map(g => g.trim());
        }
        if (searchParams.get("dateFrom")) filters.startDateFrom = searchParams.get("dateFrom");
        if (searchParams.get("dateTo")) filters.startDateTo = searchParams.get("dateTo");
        if (searchParams.get("priceMax")) filters.priceMax = parseFloat(searchParams.get("priceMax"));
        if (searchParams.get("available") === "true") filters.hasAvailableTickets = true;

        // Sorting
        let sort = ["startDate:asc"]; // Default: upcoming first
        const sortParam = searchParams.get("sort");
        if (sortParam === "price") sort = ["priceMin:asc"];
        if (sortParam === "popular") sort = ["attendeeCount:desc"];
        if (sortParam === "newest") sort = ["createdAt:desc"];

        const result = await searchEvents(query, {
            filters,
            sort,
            limit,
            offset,
            facets: ["genres", "venueCity"],
        });

        return NextResponse.json({
            type: "events",
            query,
            ...result,
        });

    } catch (error) {
        console.error("[Search API] Error:", error);

        // Return empty results instead of error for better UX
        return NextResponse.json({
            type,
            query,
            hits: [],
            totalHits: 0,
            error: process.env.NODE_ENV === "development" ? error.message : "Search unavailable",
        }, { status: 200 }); // Return 200 to not break frontend
    }
}
