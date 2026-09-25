import "../global.css";
import "@/lib/i18n";
import "@/lib/theme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryProvider } from "@/components/providers/query-provider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          {Platform.OS === "android" && (
            <StatusBar style={isDark ? "light" : "dark"} />
          )}
          <QueryProvider>
            <ThemeProvider
              value={
                isDark
                  ? {
                      ...DarkTheme,
                      colors: {
                        ...DarkTheme.colors,
                        background: "#282828",
                        card: "#282828",
                        primary: "#fafafa",
                      },
                    }
                  : {
                      ...DefaultTheme,
                      colors: {
                        ...DefaultTheme.colors,
                        background: "#ffffff",
                        card: "#ffffff",
                        primary: "#171717",
                      },
                    }
              }
            >
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="app" />
                <Stack.Screen
                  name="+not-found"
                  options={{
                    title: t("notFound.headerTitle"),
                    headerShown: true,
                    headerShadowVisible: false,
                    headerLargeTitle: Platform.OS === "ios",
                    headerTransparent: Platform.OS === "ios",
                    headerBackVisible: false,
                  }}
                />
              </Stack>
            </ThemeProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
