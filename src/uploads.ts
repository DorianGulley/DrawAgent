import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import type { Id } from "../convex/_generated/dataModel";

export async function uploadImage(uploadUrl: string, uri: string, contentType: "image/png" | "image/jpeg", maxBytes?: number): Promise<Id<"_storage">> {
  // view-shot can return a bare absolute path. Fetching it resolves against Metro
  // and uploads its HTML response instead of the screenshot's image bytes.
  const file = new File(uri.startsWith("/") ? `file://${uri}` : uri);
  if (!file.exists || file.size === 0) throw new Error("Couldn't read that image. Please select or capture it again.");
  if (maxBytes !== undefined && file.size > maxBytes) throw new Error("Photos can be up to 10 MB");
  const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: file });
  if (!response.ok) throw new Error("Upload failed. Check your connection.");
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
