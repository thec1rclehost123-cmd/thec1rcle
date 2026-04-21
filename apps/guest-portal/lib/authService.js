
/**
 * Auth Service Layer
 */

export const authService = {
    getErrorMessage(data, fallback = "Request failed") {
        return data?.error?.message || data?.message || data?.error || fallback;
    },

    async sendOtp(type, recipient) {
        const res = await fetch("/api/auth/otp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, recipient })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(this.getErrorMessage(data));
        return data;
    },

    async verifyOtp(type, recipient, code) {
        const res = await fetch("/api/auth/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, recipient, code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(this.getErrorMessage(data));
        return data.success;
    }
};
