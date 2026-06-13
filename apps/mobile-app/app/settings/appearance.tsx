import { Alert } from "react-native";
import { useSettings } from "@/hooks/useSettings";
import {
    DittoSettingsScreen,
    Divider,
    SettingsGroup,
    SettingsRow,
    SettingsSwitchRow,
} from "@/components/settings/DittoSettings";

export default function AppearanceSettingsScreen() {
    const { appearance, setAppearanceSetting } = useSettings();

    const handleTheme = () => {
        Alert.alert("Appearance", "Choose how THE C1RCLE should look.", [
            { text: "System", onPress: () => setAppearanceSetting("theme", "system") },
            { text: "Dark", onPress: () => setAppearanceSetting("theme", "dark") },
            { text: "Light", onPress: () => setAppearanceSetting("theme", "light") },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    return (
        <DittoSettingsScreen title="Appearance">
            <SettingsGroup>
                <SettingsRow
                    title="Theme"
                    value={appearance.theme === "dark" ? "Dark" : appearance.theme === "light" ? "Light" : "System"}
                    onPress={handleTheme}
                />
                <Divider />
                <SettingsSwitchRow
                    title="Reduce Motion"
                    value={appearance.reduceMotion}
                    onValueChange={(value) => setAppearanceSetting("reduceMotion", value)}
                />
                <Divider />
                <SettingsSwitchRow
                    title="Haptic Feedback"
                    value={appearance.haptics}
                    onValueChange={(value) => setAppearanceSetting("haptics", value)}
                />
            </SettingsGroup>
        </DittoSettingsScreen>
    );
}
