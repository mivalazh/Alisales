import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/lib/theme';

// Persian-first platform: force RTL app-wide (takes effect from the first
// launch; flex rows and text alignment mirror automatically).
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.page,
    card: colors.card,
    primary: colors.cta,
    text: colors.ink,
    border: colors.line,
    notification: colors.cta,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={appTheme}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '800' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'آگهی‌های من' }} />
          <Stack.Screen name="listing/new" options={{ title: 'ثبت آگهی جدید' }} />
          <Stack.Screen name="listing/[id]" options={{ title: 'ویرایش آگهی' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
