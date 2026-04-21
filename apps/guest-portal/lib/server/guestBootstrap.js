import { cookies, headers } from "next/headers";
import { callGatewayJson } from "./gatewayBridge";

export async function getGuestBootstrapFromSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__session")?.value;
    if (!token) return null;

    const headerList = await headers();
    const requestId = headerList.get("x-request-id") || undefined;

    try {
        const { response, data } = await callGatewayJson("/auth/me", {
            token,
            requestId,
            cache: "no-store",
        });

        if (!response.ok) return null;
        return data;
    } catch (error) {
        console.warn("[GuestBootstrap] Unable to load guest bootstrap", error);
        return null;
    }
}
