import { Alert } from "react-native";
import { Clock, CreditCard } from "lucide-react-native";
import {
    DittoSettingsScreen,
    SettingsGroup,
    SettingsRow,
    TileIcon,
} from "@/components/settings/DittoSettings";

export default function PaymentSettingsScreen() {
    return (
        <DittoSettingsScreen title="Payment">
            <SettingsGroup>
                <SettingsRow
                    icon={<TileIcon><CreditCard size={17} color="#fff" strokeWidth={2.4} /></TileIcon>}
                    title="Add Payment Method"
                    onPress={() => Alert.alert("Coming Soon", "Saved payment methods will be available soon.")}
                />
            </SettingsGroup>

            <SettingsGroup>
                <SettingsRow
                    icon={<TileIcon><Clock size={17} color="#fff" strokeWidth={2.4} /></TileIcon>}
                    title="Payment History"
                    onPress={() => Alert.alert("Payment History", "Payment history will be available soon.")}
                />
            </SettingsGroup>
        </DittoSettingsScreen>
    );
}
