import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ScrollView, Text } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardHeaderText, CardTitle } from "@/components/ui/card";
import { analyze } from "@/features/plants/api";
import { API_URL } from "@/lib/api/client";

// TODO(ui-owner): camera / photo picker -> analyze -> info panel + 3D scene.
// TODO(3d-owner): 3D plant via expo-gl + @react-three/fiber/native.
export default function PlantScreen() {
  const { t } = useTranslation();
  // Smoke check against the API (mock mode ignores the image). Remove once the real flow exists.
  const ping = useMutation({
    mutationFn: () => analyze({ imageBase64: "mock", mediaType: "image/jpeg" }),
  });

  return (
    <ScrollView
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 p-4"
    >
      <Text className="text-base leading-6 text-muted-foreground">
        {t("plant.description")}
      </Text>
      <Button onPress={() => ping.mutate()} disabled={ping.isPending}>
        {t("plant.testApi")}
      </Button>
      {ping.data && (
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>{ping.data.species.commonName}</CardTitle>
              <CardDescription>{ping.data.species.scientificName}</CardDescription>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-card-foreground">{ping.data.wiki.summary}</Text>
          </CardContent>
        </Card>
      )}
      {ping.error && (
        <Text className="text-sm text-destructive">
          {API_URL}: {ping.error.message}
        </Text>
      )}
    </ScrollView>
  );
}
