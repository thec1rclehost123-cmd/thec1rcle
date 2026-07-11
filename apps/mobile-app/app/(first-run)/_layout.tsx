import { Stack } from 'expo-router';

export default function FirstRunLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000000' } }} />;
}
