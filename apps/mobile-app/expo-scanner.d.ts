declare module "expo-network" {
    export interface NetworkState {
        isConnected?: boolean | null;
    }

    export function getNetworkStateAsync(): Promise<NetworkState>;
}

declare module "expo-crypto" {
    export function randomUUID(): string;
}
