import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, fonts } from "./theme";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [hint, setHint] = useState(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    try { return isIos && !standalone && !sessionStorage.getItem("clay.installHintDismissed"); } catch { return false; }
  });
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const captureInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const installed = () => { setInstall(null); setHint(false); };
    window.addEventListener("online", update); window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", captureInstall); window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && !__DEV__) navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Offline shell unavailable", error));
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); };
  }, []);

  if (!offline && !install && !hint) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, backgroundColor: colors.surface, zIndex: 100 }}>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>{offline ? "You're offline. Reconnect to load workspaces and make changes." : install ? "Keep Clay on your home screen." : "Install Clay: tap Share, then Add to Home Screen."}</Text>
      {install && !offline ? <Pressable accessibilityLabel="Install Clay" onPress={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Text style={{ fontFamily: fonts.semibold, color: colors.accent }}>Install</Text></Pressable> : null}
      {!offline && <Pressable accessibilityLabel="Dismiss install hint" onPress={() => { setInstall(null); setHint(false); try { sessionStorage.setItem("clay.installHintDismissed", "1"); } catch { /* Optional hint. */ } }}><Text style={{ padding: 5, color: colors.ink }}>✕</Text></Pressable>}
    </View>
  );
}
