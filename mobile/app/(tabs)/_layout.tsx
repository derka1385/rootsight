import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}

// Mirrors the web app's tabs: Plant / My plants / Discover.
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plant',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'leaf', android: 'eco', web: 'eco' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-plants"
        options={{
          title: 'My plants',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'drop', android: 'water_drop', web: 'water_drop' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
