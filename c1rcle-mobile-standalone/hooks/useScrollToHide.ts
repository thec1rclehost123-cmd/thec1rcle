import { useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useUIStore } from "@/store/uiStore";

export const useScrollToHide = () => {
    const { setTabBarVisible } = useUIStore();
    const lastOffset = useRef(0);
    const scrollThreshold = 10;

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentOffset = event.nativeEvent.contentOffset.y;

        // Ignore small bounces at top/bottom
        if (currentOffset <= 0) {
            setTabBarVisible(true);
            return;
        }

        const diff = currentOffset - lastOffset.current;

        if (Math.abs(diff) > scrollThreshold) {
            if (diff > 0) {
                // Scrolling down
                setTabBarVisible(false);
            } else {
                // Scrolling up
                setTabBarVisible(true);
            }
            lastOffset.current = currentOffset;
        }
    };

    return onScroll;
};
