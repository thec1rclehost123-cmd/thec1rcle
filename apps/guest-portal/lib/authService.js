
/**
 * Auth Service Layer
 */

export const authService = {
    async sendOtp(type, recipient) {
        const res = await fetch("/api/auth/otp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, recipient })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async verifyOtp(type, recipient, code) {
        const res = await fetch("/api/auth/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, recipient, code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.success;
    },

    async finalizeSignup(form) {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }
};
