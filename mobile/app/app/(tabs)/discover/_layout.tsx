import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

const isIOS = Platform.OS === "ios";

export default function DiscoverLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: isIOS,
        headerTransparent: isIOS,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: t("discover.title") }} />
    </Stack>
  );
}
