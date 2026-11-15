import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

function run(play: () => Promise<void>) {
  if (enabled) play().catch(() => {});
}

export const feel = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  tick: () => run(() => Haptics.selectionAsync()),
  land: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  commit: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type Feel = keyof typeof feel;
