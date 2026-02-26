/**
 * THE C1RCLE - Unified API Client
 * Standardized SDK for interacting with the API Gateway from any platform (Web/Mobile/Node).
 */

export class C1rcleApiClient {
    constructor(config) {
        this.baseUrl = config.baseUrl || "http://localhost:3000/api/v1";
        this.getAuthToken = config.getAuthToken || (async () => null);
        this.onUnauthorized = config.onUnauthorized || (() => { });
    }

    /**
     * Internal fetch wrapper
     */
    async request(path, options = {}) {
        const { requireAuth = true, ...fetchOptions } = options;
        const headers = {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
        };

        if (requireAuth) {
            const token = await this.getAuthToken();
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        }

        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
        });

        if (response.status === 401) {
            this.onUnauthorized();
        }

        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.error || data.message || `Request failed with status ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    // ─── Events ──────────────────────────────────────────────────

    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/events${query ? `?${query}` : ""}`, { requireAuth: false });
    }

    // ─── Checkout ────────────────────────────────────────────────

    async reserveTickets(payload) {
        return this.request("/checkout/reserve", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    async calculatePricing(payload) {
        return this.request("/checkout/calculate", {
            method: "POST",
            requireAuth: false,
            body: JSON.stringify(payload)
        });
    }

    async initiateCheckout(payload) {
        return this.request("/checkout/initiate", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    // ─── Payments ───────────────────────────────────────────────

    async verifyPayment(payload) {
        return this.request("/payments/verify", {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
    }

    // ─── Scan (Staff Only) ──────────────────────────────────────

    async processScan(payload) {
        return this.request("/scan", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    async getScanHistory(eventId, limit = 100) {
        return this.request(`/scan/history?eventId=${eventId}&limit=${limit}`);
    }

    // ─── Tickets & Transfers ─────────────────────────────────────

    async initiateTransfer(ticketId, recipientEmail) {
        return this.request("/tickets/transfer", {
            method: "POST",
            body: JSON.stringify({ ticketId, recipientEmail })
        });
    }

    async claimTicket(transferToken) {
        return this.request("/tickets/claim", {
            method: "POST",
            body: JSON.stringify({ transferToken })
        });
    }

    async getMyTickets() {
        return this.request("/tickets/my-tickets");
    }

    // ─── Staff & Venues ──────────────────────────────────────────

    async getStaffPermissions(venueId) {
        return this.request(`/staff/permissions?venueId=${venueId}`);
    }

    async inviteStaff(payload) {
        return this.request("/staff/invite", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    // ─── Profiles ────────────────────────────────────────────────

    async getProfile(id, type = "user") {
        return this.request(`/profiles/${id}?type=${type}`, { requireAuth: false });
    }

    async updateProfile(type, updates, id) {
        return this.request("/profiles", {
            method: "PATCH",
            body: JSON.stringify({ type, updates, id })
        });
    }

    async getProfilePosts(id, type = "venue", limit = 20) {
        return this.request(`/profiles/${id}/posts?type=${type}&limit=${limit}`);
    }

    async getProfileHighlights(id, type = "venue") {
        return this.request(`/profiles/${id}/highlights?type=${type}`);
    }

    // ─── Finance ──────────────────────────────────────────────────

    async getFinancialSummary(entityId, type = 'venue') {
        return this.request(`/finance/summary?entityId=${entityId}&type=${type}`);
    }

    async getTransactionHistory(entityId, limit = 50, state = null) {
        let path = `/finance/history?entityId=${entityId}&limit=${limit}`;
        if (state) path += `&state=${state}`;
        return this.request(path);
    }

    async processRefund(orderId, amount, reason) {
        return this.request('/finance/refund', {
            method: 'POST',
            body: JSON.stringify({ orderId, amount, reason })
        });
    }

    // ─── Promoters ────────────────────────────────────────────────

    async getPromoterConnections(entityId, entityType, status = null) {
        let path = `/promoters/connections?entityId=${entityId}&entityType=${entityType}`;
        if (status) path += `&status=${status}`;
        return this.request(path);
    }

    async manageConnection(action, data) {
        return this.request('/promoters/connect', {
            method: 'POST',
            body: JSON.stringify({ action, ...data })
        });
    }

    async getPromoterStats(id) {
        return this.request(`/promoters/stats/${id}`);
    }

    async generatePromoterLink(promoterId, eventId) {
        return this.request('/promoters/links', {
            method: 'POST',
            body: JSON.stringify({ promoterId, eventId })
        });
    }

    // ─── Analytics ────────────────────────────────────────────────

    async getAnalytics(id, type = 'venue', range = '30d') {
        return this.request(`/analytics/${type}/${id}?range=${range}`);
    }

    // ─── Tables ───────────────────────────────────────────────────

    async getFloorPlan(venueId) {
        return this.request(`/tables/floor-plan/${venueId}`);
    }

    async updateMasterTable(venueId, tableData) {
        return this.request(`/tables/floor-plan/${venueId}`, {
            method: 'POST',
            body: JSON.stringify(tableData)
        });
    }

    async assignTable(eventId, tableId, bookingId, status = 'assigned') {
        return this.request('/tables/assign', {
            method: 'POST',
            body: JSON.stringify({ eventId, tableId, bookingId, status })
        });
    }

    async getEventAssignments(eventId) {
        return this.request(`/tables/assignments/${eventId}`);
    }

    // ─── Waitlist ─────────────────────────────────────────────────

    async joinWaitlist(data) {
        return this.request('/waitlist/join', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async processWaitlist(eventId, tierId) {
        return this.request('/waitlist/process', {
            method: 'POST',
            body: JSON.stringify({ eventId, tierId })
        });
    }

    async verifyWaitlistAccess(eventId, email) {
        return this.request(`/waitlist/verify?eventId=${eventId}&email=${email}`);
    }

    // ─── Search ───────────────────────────────────────────────────

    async search(q, filters = {}) {
        const query = new URLSearchParams({ q, ...filters }).toString();
        return this.request(`/search?${query}`, { requireAuth: false });
    }

    async getAnalytics(type, id, subCategory = 'overview') {
        return this.request(`/analytics/${type}/${id}/${subCategory}`);
    }

    // ─── Calendar ────────────────────────────────────────────────

    async getVenueAvailability(venueId, start, end) {
        return this.request(`/calendar/venue/${venueId}?start=${start}&end=${end}`);
    }

    async blockVenueDate(venueId, date, reason, startTime = null, endTime = null) {
        return this.request('/calendar/block', {
            method: 'POST',
            body: JSON.stringify({ venueId, date, reason, startTime, endTime })
        });
    }

    async requestSlot(data) {
        return this.request('/calendar/slots/request', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async respondToSlot(id, action, responseData = {}) {
        return this.request('/calendar/slots/respond', {
            method: 'POST',
            body: JSON.stringify({ id, action, responseData })
        });
    }

    async getOperatingCalendar(partnerId, role, start, end) {
        return this.request(`/calendar/operating?partnerId=${partnerId}&role=${role}&start=${start}&end=${end}`);
    }

    // ─── Promos ──────────────────────────────────────────────────

    async getEventPromos(eventId) {
        return this.request(`/promos/event/${eventId}`);
    }

    async validatePromo(eventId, code, userId = null, items = []) {
        return this.request('/promos/validate', {
            method: 'POST',
            body: JSON.stringify({ eventId, code, userId, items })
        });
    }

    // ─── Financials (Extended) ───────────────────────────────────

    async getPromoterPayoutBalance(promoterId) {
        return this.request(`/finance/promoter/balance/${promoterId}`);
    }

    async requestPromoterPayout(amount, paymentMethod, paymentDetails, promoterId = null) {
        return this.request('/finance/payout/request', {
            method: 'POST',
            body: JSON.stringify({ amount, paymentMethod, paymentDetails, promoterId })
        });
    }

    // ─── CMS (New Phase 11) ───────────────────────────────────────

    async createHighlight(venueId, data) {
        return this.request('/cms/highlights', {
            method: 'POST',
            body: JSON.stringify({ venueId, ...data })
        });
    }

    async updateHighlight(highlightId, venueId, updates) {
        return this.request(`/cms/highlights/${highlightId}`, {
            method: 'PATCH',
            body: JSON.stringify({ venueId, ...updates })
        });
    }

    async getVenueCMSData(venueId) {
        return this.request(`/cms/venue/${venueId}`);
    }

    async addGalleryPhoto(venueId, imageUrl, caption = "") {
        return this.request('/cms/gallery', {
            method: 'POST',
            body: JSON.stringify({ venueId, imageUrl, caption })
        });
    }

    async initVenueFacilities(venueId) {
        return this.request('/cms/facilities/init', {
            method: 'POST',
            body: JSON.stringify({ venueId })
        });
    }

    // ─── Staff Management (Enhanced) ──────────────────────────────

    async listStaff(venueId, isActive = true) {
        return this.request(`/staff/list?venueId=${venueId}&isActive=${isActive}`);
    }

    async updateStaff(staffId, venueId, updates) {
        return this.request(`/staff/${staffId}`, {
            method: 'PATCH',
            body: JSON.stringify({ venueId, ...updates })
        });
    }

    async removeStaff(staffId, venueId) {
        return this.request(`/staff/${staffId}?venueId=${venueId}`, {
            method: 'DELETE'
        });
    }

    // ─── Event Management (Enhanced) ──────────────────────────────

    async createEvent(payload) {
        return this.request('/events', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async updateEvent(eventId, payload) {
        return this.request(`/events/${eventId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
    }

    async deleteEvent(eventId) {
        return this.request(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    async getEvent(eventId) {
        return this.request(`/events/${eventId}`);
    }

    async listEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/events?${query}`);
    }

    async getEventInventory(eventId) {
        return this.request(`/inventory/${eventId}/summary`);
    }

    async getEventOrders(eventId, options = {}) {
        const query = new URLSearchParams(options).toString();
        return this.request(`/orders/event/${eventId}?${query}`);
    }

    async getEventSalesStats(eventId) {
        return this.request(`/orders/stats/${eventId}`);
    }

    async getStaffPermissions(venueId) {
        return this.request(`/staff/permissions?venueId=${venueId}`);
    }

    // ─── Partnerships ─────────────────────────────────────────────

    async requestPartnership(hostId, venueId, hostName, venueName) {
        return this.request('/partnerships/request', {
            method: 'POST',
            body: JSON.stringify({ hostId, venueId, hostName, venueName })
        });
    }

    async listPartnerships(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/partnerships?${query}`);
    }

    async respondToPartnership(id, action, reason = '') {
        return this.request(`/partnerships/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action, reason })
        });
    }

    async checkPartnership(hostId, venueId) {
        return this.request(`/partnerships/check?hostId=${hostId}&venueId=${venueId}`);
    }

    // ─── Promoter Links ───────────────────────────────────────────

    async createPromoterLink(data) {
        return this.request('/promoter-links/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async listPromoterLinks(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/promoter-links?${query}`);
    }

    async getPromoterLinkByCode(code) {
        return this.request(`/promoter-links/by-code/${code}`);
    }

    async getPromoterStats(promoterId) {
        return this.request(`/promoter-links/stats/${promoterId}`);
    }

    async getEventPromoterSummary(eventId) {
        return this.request(`/promoter-links/event-summary/${eventId}`);
    }

    async deactivatePromoterLink(id) {
        return this.request(`/promoter-links/${id}/deactivate`, { method: 'PATCH', body: '{}' });
    }

    // ─── Refunds ─────────────────────────────────────────────────

    async requestRefund(orderId, reason, amount = null, source = 'user') {
        return this.request('/refunds/request', {
            method: 'POST',
            body: JSON.stringify({ orderId, reason, amount, source })
        });
    }

    async getPendingRefunds(options = {}) {
        const query = new URLSearchParams(options).toString();
        return this.request(`/refunds/pending?${query}`);
    }

    async getOrderRefundHistory(orderId) {
        return this.request(`/refunds/order/${orderId}`);
    }

    async respondToRefund(id, action, reason = '') {
        return this.request(`/refunds/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action, reason })
        });
    }

    // ─── Registers ───────────────────────────────────────────────

    async getDateRegister(venueId, date) {
        return this.request(`/registers/${venueId}/${date}`);
    }

    async getRegistersForRange(venueId, startDate, endDate) {
        return this.request(`/registers/${venueId}/range?startDate=${startDate}&endDate=${endDate}`);
    }

    async updateRegister(venueId, date, updates) {
        return this.request(`/registers/${venueId}/${date}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    }
}






