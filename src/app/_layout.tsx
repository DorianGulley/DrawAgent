import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { convex } from "../convex";
import { PwaStatus } from "../pwa";
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
      <PwaStatus />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="project/[id]" options={{ animation: "fade_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="design/[id]" options={{ animation: "fade_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="new/index" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="new/[kind]" />
        <Stack.Screen name="style" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="workspace/new" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="workspace/[id]" />
        <Stack.Screen name="part/[id]" options={{ animation: "fade_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="history/[id]" options={{ animation: "fade" }} />
      </Stack>
    </ConvexProvider>
  );
}
