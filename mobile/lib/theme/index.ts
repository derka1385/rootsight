import Storage from "expo-sqlite/kv-store";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";

export type ThemePreference = "system" | "light" | "dark";

let current = (Storage.getItemSync("app.theme") as ThemePreference) ?? "system";
Appearance.setColorScheme(current === "system" ? "unspecified" : current);

const listeners = new Set<() => void>();

export function setThemePreference(next: ThemePreference) {
  current = next;
  Appearance.setColorScheme(next === "system" ? "unspecified" : next);
  Storage.setItemAsync("app.theme", next);
  listeners.forEach((l) => l());
}

export function useThemePreference() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return [value, setThemePreference] as const;
}
