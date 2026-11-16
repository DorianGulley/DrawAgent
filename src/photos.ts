import { useAction, useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { deviceKey } from "./device";

const MAX_BYTES = 10 * 1024 * 1024;

export type PhotoSource = "library" | "camera";

export function choosePhotoSource(): Promise<PhotoSource | null> {
  return new Promise((resolve) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: "Add a photo", options: ["Choose from library", "Take a photo", "Cancel"], cancelButtonIndex: 2 }, (choice) =>
      resolve(choice === 0 ? "library" : choice === 1 ? "camera" : null),
    ),
  );
}

export function usePhotoUpload(workspaceId: Id<"workspaces"> | undefined) {
  const generateUploadUrl = useMutation(api.feedback.generateUploadUrl);
  const add = useAction(api.assets.add);

  return async (source: PhotoSource): Promise<{ id: Id<"assets">; uri: string } | null> => {
    if (!workspaceId) return null;
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error(source === "camera" ? "Allow camera access in Settings to take a photo." : "Allow photo access in Settings to add photos.");
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.82, allowsEditing: false, exif: false };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return null;
    const picked = result.assets[0];
    if (picked.fileSize && picked.fileSize > MAX_BYTES) throw new Error("Photos can be up to 10 MB");
    const blob = await (await fetch(picked.uri)).blob();
    if (blob.size > MAX_BYTES) throw new Error("Photos can be up to 10 MB");
    const response = await fetch(await generateUploadUrl(), { method: "POST", headers: { "Content-Type": picked.mimeType ?? "image/jpeg" }, body: blob });
    if (!response.ok) throw new Error("The upload didn't go through");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    const id = await add({
      deviceKey: deviceKey(),
      workspaceId,
      storageId,
      name: (picked.fileName ?? "Photo").replace(/\.[a-z0-9]+$/i, ""),
      width: picked.width,
      height: picked.height,
    });
    return { id, uri: picked.uri };
  };
}

export function problemText(problem: unknown, fallback: string): string {
  if (!(problem instanceof Error)) return fallback;
  return problem.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] || fallback;
}
