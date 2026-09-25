import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const background = isDark ? "#282828" : "#ffffff";
  const tint = isDark ? "#ffffff" : "#343434";
  const overlay = isDark ? "#ffffff22" : "#34343422";
  return (
    <NativeTabs
      backgroundColor={background}
      tintColor={tint}
      iconColor={{ selected: tint }}
      labelStyle={{ selected: { color: tint } }}
      indicatorColor={overlay}
      rippleColor={overlay}
    >
      <NativeTabs.Trigger name="plant">
        <NativeTabs.Trigger.Label>{t("plant.title")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "leaf", selected: "leaf.fill" }} md="eco" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-plants">
        <NativeTabs.Trigger.Label>{t("myPlants.title")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "drop", selected: "drop.fill" }} md="water_drop" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>{t("discover.title")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
