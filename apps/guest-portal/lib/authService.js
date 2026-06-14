
import { getApiErrorMessage, guestApi } from "./api/client";

/**
 * Auth Service Layer
 */

export const authService = {
    async sendOtp(type, recipient) {
        const { response, data } = await guestApi.auth.sendOtp({ type, recipient });
        if (!response.ok) throw new Error(getApiErrorMessage(data));
        return data;
    },

    async verifyOtp(type, recipient, code) {
        const { response, data } = await guestApi.auth.verifyOtp({ type, recipient, code });
        if (!response.ok) throw new Error(getApiErrorMessage(data));
        return data.success;
    }
};
