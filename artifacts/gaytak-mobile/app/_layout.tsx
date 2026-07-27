import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useNotifications, initNotifications, registerBackgroundTask } from "@/hooks/useNotifications";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
setAuthTokenGetter(async () => AsyncStorage.getItem("glow_token"));

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotificationsManager() {
  const { user } = useAuth();
  useNotifications(user?.id ?? null);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="story/[userId]" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="my-listings" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="ride-request" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="ride-driver" options={{ headerShown: false }} />
      <Stack.Screen name="driver-register" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="driver-subscribe" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="(auth)/pin-setup" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/pin-lock" options={{ headerShown: false }} />
      <Stack.Screen name="role-select" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    initNotifications().then(() => {
      // تسجيل مهمة الخلفية بعد الأذونات — تُعمّل الإشعار حتى لو التطبيق مغلق
      registerBackgroundTask();
    });
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationsManager />
            <GestureHandlerRootView>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
