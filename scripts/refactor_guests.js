const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '../apps/partner-dashboard/app/promoter/guests/PageClient.tsx',
);
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Search, Filter imports
content = content.replace(
  /Loader2,\n\} from "lucide-react";/,
  `Loader2,\n    Search,\n    Filter,\n} from "lucide-react";`,
);

// Remove SWR import
content = content.replace(/import useSWR from "swr";\n/, '');

// Add useDebounce hook at top
const debounceHook = `
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}
`;
content = content.replace(
  'export default function GuestStreamPage() {',
  debounceHook + '\nexport default function GuestStreamPage() {',
);

// 2. Replace state and fetcher
const originalState = `    const [guests, setGuests] = useState<GuestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "pending">("all");
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;`;

const newState = `    const [guests, setGuests] = useState<GuestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "pending">("all");
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Debounced Search & Filters
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [selectedEventId, setSelectedEventId] = useState<string>("all");

    // Cursor Pagination state
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);`;

content = content.replace(originalState, newState);

// Replace fetcher and useSWR with fetchGuests
const originalFetcherRegex =
  /const fetcher = async \([\s\S]*?const loading = !guests\.length && !error && promoterId;/;

const newFetchGuests = `
    const fetchGuests = useCallback(async (isRefresh = false, cursor: string | null = null) => {
        if (!promoterId) return;
        if (isRefresh) setRefreshing(true);
        else if (cursor) setLoadingMore(true);
        else setLoading(true);

        try {
            const token = await user?.getIdToken();
            const headers = token ? { Authorization: \`Bearer \${token}\` } : undefined;
            const params = new URLSearchParams({ limit: "20" });
            if (cursor) params.set("cursor", cursor);
            if (filterStatus !== "all") params.set("status", filterStatus);
            if (selectedEventId && selectedEventId !== "all") params.set("eventId", selectedEventId);

            const res = await fetch(\`/api/partners/promoters/guests?\${params.toString()}\`, { headers });
            if (!res.ok) throw new Error("Failed to fetch guests");
            const data = await res.json();
            
            let fetchedGuests = data.guests || [];
            
            // Client-side search (since Firestore full-text is limited)
            if (debouncedSearch) {
                const lower = debouncedSearch.toLowerCase();
                fetchedGuests = fetchedGuests.filter((g: any) => 
                    g.guestName?.toLowerCase().includes(lower) || 
                    g.eventTitle?.toLowerCase().includes(lower) ||
                    g.promoterCode?.toLowerCase().includes(lower)
                );
            }

            if (cursor) {
                setGuests(prev => [...prev, ...fetchedGuests]);
            } else {
                setGuests(fetchedGuests);
            }
            
            setNextCursor(data.nextCursor || null);
            setError(false);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [promoterId, user, filterStatus, selectedEventId, debouncedSearch]);

    // Re-fetch when dependencies change
    useEffect(() => {
        fetchGuests();
    }, [fetchGuests]);

    // Auto-refresh polling (first page only)
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => fetchGuests(true), 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchGuests]);

    const mutate = () => fetchGuests(true);
`;

content = content.replace(originalFetcherRegex, newFetchGuests);

// Remove the filteredGuests & paginatedGuests logic
const filterRegex =
  /const filteredGuests = guests\.filter\(\(g\) => \{[\s\S]*?const paginatedGuests = filteredGuests\.slice\(\(currentPage - 1\) \* itemsPerPage, currentPage \* itemsPerPage\);/;
content = content.replace(filterRegex, '');

// Replace `paginatedGuests.map` with `guests.map`
content = content.replace(/paginatedGuests\.map/g, 'guests.map');

// Inject the search/filter UI
const listStartRegex = /\{\/\* ── Guest list ── \*\/\}/;

const searchUI = `
            {/* ── Filters & Search ── */}
            <motion.div {...mp(0.09)} className="flex flex-col md:flex-row gap-3 mb-6 mt-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input
                        type="text"
                        placeholder="Search guests by name or promo code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-brand-primary/50 transition-colors placeholder:text-text-tertiary text-text-primary"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="bg-white/[0.03] border border-white/5 rounded-2xl py-3 px-4 text-sm text-text-secondary focus:outline-none appearance-none min-w-[140px]"
                    >
                        <option value="all">All Status</option>
                        <option value="checked_in">Checked In</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </motion.div>

            {/* ── Guest list ── */}`;

content = content.replace(listStartRegex, searchUI);

// Add Load More Button at the end of the list
const listEndRegex = /\{\/\* Empty padding \*\/\}/;
const loadMoreUI = `
                        {/* Load More Button */}
                        {nextCursor && guests.length > 0 && (
                            <div className="p-6 text-center border-t border-white/[0.03]">
                                <button
                                    onClick={() => fetchGuests(false, nextCursor)}
                                    disabled={loadingMore}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white/[0.03] hover:bg-white/[0.06] text-text-secondary transition-all"
                                >
                                    {loadingMore ? (
                                        <><Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading...</>
                                    ) : (
                                        "Load More"
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Empty padding */}`;

content = content.replace(listEndRegex, loadMoreUI);

// Write back
fs.writeFileSync(filePath, content);
console.log('Refactored PageClient.tsx successfully');
