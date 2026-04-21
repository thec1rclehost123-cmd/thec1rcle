import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
} from "react-native-reanimated";
import { useEvent } from "@/store/eventContext";
import { processQRScan } from "@/lib/api/scan";
import ScanResult from "@/components/Scanner/ScanResult";
import CoupleConfirmModal from "@/components/Scanner/CoupleConfirmModal";

const { width, height } = Dimensions.get("window");
const SCAN_AREA_SIZE = width * 0.7;

type ScanResultType = "valid" | "already_scanned" | "invalid" | "wrong_event" | "not_confirmed" | null;

interface ScanResultData {
    type: ScanResultType;
    message: string;
    guest?: {
        name: string;
        ticketType: string;
        quantity: number;
        entryType: string;
    };
    previousScan?: {
        time: string;
        by: string;
    };
}

export default function ScanScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(true);
    const [flashEnabled, setFlashEnabled] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
    const [showCoupleModal, setShowCoupleModal] = useState(false);
    const [pendingCoupleData, setPendingCoupleData] = useState<any>(null);
    const [entryCount, setEntryCount] = useState(0);

    const { eventData } = useEvent();
    const lastScannedRef = useRef<string | null>(null);
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Animation values
    const resultScale = useSharedValue(0);
    const resultOpacity = useSharedValue(0);

    useEffect(() => {
        if (eventData?.stats) {
            setEntryCount(eventData.stats.totalEntered);
        }
    }, [eventData]);

    const showResult = (result: ScanResultData) => {
        setScanResult(result);
        resultScale.value = withSpring(1, { damping: 15 });
        resultOpacity.value = withTiming(1, { duration: 200 });

        // Haptic feedback
        if (result.type === "valid") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (result.type === "already_scanned") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        // Auto dismiss after 3 seconds
        scanTimeoutRef.current = setTimeout(() => {
            dismissResult();
        }, 3000);
    };

    const dismissResult = () => {
        resultScale.value = withSpring(0);
        resultOpacity.value = withTiming(0, { duration: 200 });

        setTimeout(() => {
            setScanResult(null);
            setIsScanning(true);
            lastScannedRef.current = null;
        }, 200);
    };

    const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
        // Prevent duplicate scans
        if (!isScanning || data === lastScannedRef.current) return;

        setIsScanning(false);
        lastScannedRef.current = data;

        try {
            const result = await processQRScan({
                qrData: data,
                eventId: eventData?.event.id || "",
                eventCode: eventData?.code || "",
                gate: eventData?.gate,
            });

            // Check for couple ticket that needs partner confirmation
            if (result.success && result.ticket?.entryType === "couple") {
                setPendingCoupleData(result);
                setShowCoupleModal(true);
                return;
            }

            handleScanResult(result);
        } catch (error: any) {
            showResult({
                type: "invalid",
                message: error.message || "Scan failed",
            });
        }
    };

    const handleScanResult = (result: any) => {
        if (result.success) {
            setEntryCount((prev) => prev + (result.ticket?.quantity || 1));
            showResult({
                type: "valid",
                message: result.message || "Entry approved!",
                guest: {
                    name: result.ticket?.userName || "Guest",
                    ticketType: result.ticket?.ticketName || "Entry",
                    quantity: result.ticket?.quantity || 1,
                    entryType: result.ticket?.entryType || "general",
                },
            });
        } else {
            showResult({
                type: result.result || "invalid",
                message: result.error || "Invalid ticket",
                previousScan: result.previousScan,
            });
        }
    };

    const handleCoupleConfirm = (partnerPresent: boolean) => {
        setShowCoupleModal(false);

        if (partnerPresent && pendingCoupleData) {
            // Complete the couple entry
            handleScanResult(pendingCoupleData);
        } else {
            // Reject - partner not present
            showResult({
                type: "invalid",
                message: "Couple entry requires both guests present",
            });
        }
        setPendingCoupleData(null);
    };

    const resultAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: resultScale.value }],
        opacity: resultOpacity.value,
    }));

    // Permission handling
    if (!permission) {
        return (
            <View className="flex-1 bg-background-primary items-center justify-center">
                <Text className="text-text-secondary">Loading camera...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
                <Ionicons name="camera-outline" size={64} color="#71717A" />
                <Text className="text-text-primary text-xl font-bold mt-4 text-center">
                    Camera Access Required
                </Text>
                <Text className="text-text-secondary text-center mt-2 mb-6">
                    We need camera permission to scan ticket QR codes
                </Text>
                <TouchableOpacity
                    onPress={requestPermission}
                    className="bg-accent px-8 py-4 rounded-xl"
                >
                    <Text className="text-white font-bold text-lg">Grant Permission</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-background-primary">
            {/* Camera View */}
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                enableTorch={flashEnabled}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
            />

            {/* Overlay */}
            <View className="flex-1">
                {/* Top Stats Bar */}
                <View className="flex-row items-center justify-between px-4 py-3 bg-black/60">
                    <View className="flex-row items-center">
                        <View className="w-3 h-3 rounded-full bg-success mr-2 opacity-80" />
                        <Text className="text-white font-medium">Scanning Active</Text>
                    </View>
                    <View className="flex-row items-center">
                        <Text className="text-white font-bold text-lg">{entryCount}</Text>
                        <Text className="text-white/70 ml-1">entered</Text>
                    </View>
                </View>

                {/* Scan Area Frame */}
                <View className="flex-1 items-center justify-center">
                    <View
                        style={{
                            width: SCAN_AREA_SIZE,
                            height: SCAN_AREA_SIZE,
                            borderWidth: 3,
                            borderColor: scanResult?.type === "valid"
                                ? "#22C55E"
                                : scanResult?.type === "already_scanned"
                                    ? "#F59E0B"
                                    : scanResult?.type
                                        ? "#EF4444"
                                        : "#FFFFFF",
                            borderRadius: 24,
                        }}
                    >
                        {/* Corner accents */}
                        <View className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-xl" />
                        <View className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-xl" />
                        <View className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-xl" />
                        <View className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-xl" />
                    </View>

                    <Text className="text-white/80 mt-6 text-center">
                        Point camera at ticket QR code
                    </Text>
                </View>

                {/* Bottom Controls */}
                <View className="flex-row items-center justify-center gap-8 pb-8 bg-black/60 pt-4">
                    <TouchableOpacity
                        onPress={() => setFlashEnabled(!flashEnabled)}
                        className={`w-14 h-14 rounded-full items-center justify-center ${flashEnabled ? "bg-warning" : "bg-white/20"
                            }`}
                    >
                        <Ionicons
                            name={flashEnabled ? "flash" : "flash-off"}
                            size={24}
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Scan Result Overlay */}
            {scanResult && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        resultAnimatedStyle,
                        { zIndex: 100 },
                    ]}
                >
                    <ScanResult
                        result={scanResult}
                        onDismiss={dismissResult}
                    />
                </Animated.View>
            )}

            {/* Couple Confirmation Modal */}
            <CoupleConfirmModal
                visible={showCoupleModal}
                onConfirm={handleCoupleConfirm}
                guestName={pendingCoupleData?.ticket?.userName}
            />
        </View>
    );
}
