import type { Id } from "../convex/_generated/dataModel";

export async function uploadImage(uploadUrl: string, uri: string, contentType: "image/png" | "image/jpeg", maxBytes?: number): Promise<Id<"_storage">> {
  const image = await fetch(uri);
  if (!image.ok) throw new Error("Couldn't read that image. Please select or capture it again.");
  const blob = await image.blob();
  if (!blob.size || !blob.type.startsWith("image/")) throw new Error("Couldn't read that image. Please select or capture it again.");
  if (maxBytes !== undefined && blob.size > maxBytes) throw new Error("Photos can be up to 10 MB");
  const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: blob });
  if (!response.ok) throw new Error("Upload failed. Check your connection.");
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
