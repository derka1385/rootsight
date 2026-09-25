import { useTranslation } from "react-i18next";
import { ScrollView, Text } from "react-native";

// TODO(ui-owner): port web/src/components/Discover.tsx.
export default function DiscoverScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 p-4"
    >
      <Text className="text-base leading-6 text-muted-foreground">
        {t("discover.description")}
      </Text>
    </ScrollView>
  );
}
