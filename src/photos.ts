import { useAction, useMutation } from "convex/react";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { deviceKey } from "./device";
import { uploadImage } from "./uploads";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2048;

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
    if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error("Allow camera access in Settings to take a photo.");
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.82, allowsEditing: false, exif: false };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return null;
    const picked = result.assets[0];
    const context = ImageManipulator.manipulate(picked.uri);
    const scale = Math.min(1, MAX_SIDE / Math.max(picked.width, picked.height));
    if (scale < 1) context.resize({ width: Math.round(picked.width * scale), height: Math.round(picked.height * scale) });
    const rendered = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    const storageId = await uploadImage(await generateUploadUrl(), rendered.uri, "image/jpeg", MAX_BYTES);
    const id = await add({
      deviceKey: deviceKey(),
      workspaceId,
      storageId,
      name: (picked.fileName ?? "Photo").replace(/\.[a-z0-9]+$/i, ""),
      width: rendered.width,
      height: rendered.height,
    });
    return { id, uri: rendered.uri };
  };
}

export function problemText(problem: unknown, fallback: string): string {
  if (!(problem instanceof Error)) return fallback;
  return problem.message.replace(/^.*Uncaught Error: /s, "").split("\n")[0] || fallback;
}
