/**
 * City Store
 * Manages the user's selected city and geolocation-based city detection.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export interface CityInfo {
    key: string;
    label: string;
    isDetected?: boolean;
    coordinates?: {
        latitude: number;
        longitude: number;
    }
}

// Same map as in eventsStore for consistency
export const CITY_MAP = [
    { key: "pune-in", label: "Pune, IN", matches: ["pune", "kp", "koregaon", "baner", "viman", "magarpatta", "hinjewadi", "kalyani"] },
    { key: "mumbai-in", label: "Mumbai, IN", matches: ["mumbai", "bandra", "andheri", "juhu", "worli", "colaba", "powai", "thane", "navi mumbai"] },
    { key: "bengaluru-in", label: "Bengaluru, IN", matches: ["bangalore", "bengaluru", "blr", "koramangala", "indiranagar", "hsr", "whitefield", "electronic city"] },
    { key: "goa-in", label: "Goa, IN", matches: ["goa", "anjuna", "morjim", "panjim", "panaji", "vagator", "baga", "calangute", "siolim", "assagao"] },
    { key: "delhi-in", label: "Delhi NCR, IN", matches: ["delhi", "gurgaon", "noida", "ncr", "saket", "hauz khas", "gurugram"] },
    { key: "hyderabad-in", label: "Hyderabad, IN", matches: ["hyderabad", "jubilee", "banjara", "hitech", "gachibowli"] },
    { key: "chennai-in", label: "Chennai, IN", matches: ["chennai", "madras", "adyar", "velachery", "omr"] },
    { key: "kolkata-in", label: "Kolkata, IN", matches: ["kolkata", "calcutta", "salt lake", "new town"] },
    { key: "jaipur-in", label: "Jaipur, IN", matches: ["jaipur", "pink city"] },
    { key: "chandigarh-in", label: "Chandigarh, IN", matches: ["chandigarh", "mohali", "panchkula"] }
];

interface CityState {
    selectedCity: CityInfo;
    detectedCity: CityInfo | null;
    userLocation: { latitude: number; longitude: number } | null;
    isLocating: boolean;

    // Actions
    setCity: (cityKey: string) => void;
    detectLocation: () => Promise<void>;
    initCity: () => Promise<void>;
}

const DEFAULT_CITY = CITY_MAP[1]; // Mumbai

export const useCityStore = create<CityState>()(
    persist(
        (set, get) => ({
            selectedCity: DEFAULT_CITY,
            detectedCity: null,
            userLocation: null,
            isLocating: false,

            setCity: (cityKey: string) => {
                const city = CITY_MAP.find(c => c.key === cityKey);
                if (city) {
                    set({ selectedCity: city });
                }
            },

            detectLocation: async () => {
                set({ isLocating: true });
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== "granted") {
                        set({ isLocating: false });
                        return;
                    }

                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Low
                    });

                    const [address] = await Location.reverseGeocodeAsync({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    });

                    if (address && address.city) {
                        const input = address.city.toLowerCase();
                        const found = CITY_MAP.find(c =>
                            c.matches.some(m => input.includes(m)) ||
                            input.includes(c.key.split("-")[0])
                        );

                        if (found) {
                            const coords = {
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude
                            };

                            const detected = {
                                ...found,
                                isDetected: true,
                                coordinates: coords
                            };

                            set({
                                detectedCity: detected,
                                userLocation: coords
                            });

                            // Optionally auto-set if no city selection exists
                            if (!get().selectedCity.key || get().selectedCity.key === DEFAULT_CITY.key) {
                                set({ selectedCity: detected });
                            }
                        }
                    }
                } catch (error) {
                    console.warn("[CityStore] Location detection failed", error);
                } finally {
                    set({ isLocating: false });
                }
            },

            initCity: async () => {
                // If we don't have a selection, try to detect
                if (get().selectedCity.key === DEFAULT_CITY.key) {
                    await get().detectLocation();
                }
            }
        }),
        {
            name: "c1rcle-city-storage",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
