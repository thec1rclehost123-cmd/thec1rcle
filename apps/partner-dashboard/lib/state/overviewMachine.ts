/**
 * Overview Page State Machine
 *
 * Manages the lifecycle of the venue dashboard overview page.
 * Using a reducer keeps all state transitions in one place,
 * making them easy to test and reason about.
 *
 * States:
 *   initial         — before any fetch has started
 *   loading         — first load (no previous data to show)
 *   partial         — data loaded but some fetches failed, or no live event
 *   live_active     — all data loaded + Firestore snapshot connected
 *   filter_updating — range changed; stale data visible while re-fetching
 *   degraded        — data loaded but with errors (shows inline warnings)
 *   offline         — browser reports no network
 */

export type OverviewStatus =
    | 'initial'
    | 'loading'
    | 'partial'
    | 'live_active'
    | 'filter_updating'
    | 'degraded'
    | 'offline'

export interface OverviewState {
    status: OverviewStatus
    /** True when today's event has an active Firestore snapshot */
    hasLiveEvent: boolean
    /** Names of data slices that failed to load, e.g. ['kpis', 'finance'] */
    failures: string[]
    /** ISO string of the last successful full fetch */
    lastRefreshedAt: string | null
}

export type OverviewAction =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_PARTIAL'; failures: string[] }
    | { type: 'FETCH_SUCCESS' }
    | { type: 'LIVE_CONNECTED' }
    | { type: 'LIVE_ENDED' }
    | { type: 'LIVE_DEGRADED' }
    | { type: 'FILTER_CHANGED' }
    | { type: 'NETWORK_OFFLINE' }
    | { type: 'NETWORK_ONLINE' }

export const initialOverviewState: OverviewState = {
    status: 'initial',
    hasLiveEvent: false,
    failures: [],
    lastRefreshedAt: null,
}

export function overviewReducer(
    state: OverviewState,
    action: OverviewAction,
): OverviewState {
    switch (action.type) {
        case 'FETCH_START':
            // If we already have data, keep it visible while re-fetching
            return {
                ...state,
                status: state.lastRefreshedAt ? 'filter_updating' : 'loading',
            }

        case 'FETCH_PARTIAL':
            return {
                ...state,
                status: 'partial',
                failures: action.failures,
                lastRefreshedAt: new Date().toISOString(),
            }

        case 'FETCH_SUCCESS':
            return {
                ...state,
                // Promote to live_active only when snapshot is already connected
                status: state.hasLiveEvent ? 'live_active' : 'partial',
                failures: state.failures.filter(f => f === 'live_snapshot'),
                lastRefreshedAt: new Date().toISOString(),
            }

        case 'LIVE_CONNECTED':
            return {
                ...state,
                status: 'live_active',
                hasLiveEvent: true,
                // Clear snapshot failure if it was previously set
                failures: state.failures.filter(f => f !== 'live_snapshot'),
            }

        case 'LIVE_ENDED':
            return {
                ...state,
                hasLiveEvent: false,
                status: state.status === 'live_active' ? 'partial' : state.status,
            }

        case 'LIVE_DEGRADED':
            return {
                ...state,
                // Deduplicate failures array
                failures: [...new Set([...state.failures, 'live_snapshot'])],
            }

        case 'FILTER_CHANGED':
            return {
                ...state,
                status: state.lastRefreshedAt ? 'filter_updating' : 'loading',
            }

        case 'NETWORK_OFFLINE':
            return { ...state, status: 'offline' }

        case 'NETWORK_ONLINE':
            return {
                ...state,
                status: state.lastRefreshedAt ? 'filter_updating' : 'loading',
            }

        default:
            return state
    }
}
