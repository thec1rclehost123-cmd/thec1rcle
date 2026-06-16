declare module "expo-network" {
    export interface NetworkState {
        isConnected?: boolean | null;
    }

    export function getNetworkStateAsync(): Promise<NetworkState>;
}

declare module "expo-crypto" {
    export function randomUUID(): string;
}

declare module "react-native-razorpay" {
    const RazorpayCheckout: any;
    export default RazorpayCheckout;
}
