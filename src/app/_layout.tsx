import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { convex } from "../convex";
import { colors } from "../theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ConvexProvider client={convex}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="project/[id]" options={{ animation: "fade_from_bottom", gestureEnabled: false }} />
      </Stack>
    </ConvexProvider>
  );
}
