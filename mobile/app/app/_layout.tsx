import { Stack } from "expo-router";

// Screens registered here, next to (tabs), open over the tab bar (sheets, camera, full-screen flows).
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
