import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { defaultConfig } from '@tamagui/config/v4';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { createTamagui, TamaguiProvider } from 'tamagui';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';

const config = createTamagui(defaultConfig);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <TamaguiProvider config={config}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </TamaguiProvider>
  );
}
