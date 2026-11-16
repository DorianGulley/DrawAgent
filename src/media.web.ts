export async function requestPermissionsAsync(_writeOnly?: boolean) { return { granted: true }; }
export async function saveToLibraryAsync(uri: string) {
  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.download = "clay-design.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
