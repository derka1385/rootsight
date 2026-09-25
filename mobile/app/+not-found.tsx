import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <>
      <ScrollView
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 96 + insets.bottom,
        }}
      >
        <View className="gap-5">
          <Text className="text-base leading-6 text-muted-foreground">
            {t("notFound.description")}
          </Text>
        </View>
      </ScrollView>

      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 8 }}
        className="bg-background px-4 pt-2"
      >
        <Button onPress={() => router.replace("/app/plant")}>
          {t("notFound.buttonText")}
        </Button>
      </View>
    </>
  );
}
