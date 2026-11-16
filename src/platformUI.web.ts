import type { ActionSheetIOSOptions, AlertButton } from "react-native";

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const text = [title, message].filter(Boolean).join("\n\n");
    const action = buttons?.find((button) => button.style !== "cancel");
    if (!action) { window.alert(text); return; }
    if (window.confirm(text)) action.onPress?.();
    else buttons?.find((button) => button.style === "cancel")?.onPress?.();
  },
  prompt(title: string, message?: string, callback?: (value: string) => void, _type?: string, defaultValue?: string) {
    const value = window.prompt([title, message].filter(Boolean).join("\n"), defaultValue);
    if (value !== null) callback?.(value);
  },
};

export const ActionSheetIOS = {
  showActionSheetWithOptions(options: ActionSheetIOSOptions, onChoice: (index: number) => void) {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", options.title ?? "Choose an action");
    Object.assign(dialog.style, { border: "none", borderRadius: "24px", padding: "12px", width: "min(92vw, 420px)", background: "#F3EEE6", color: "#1B1A17", fontFamily: "system-ui", boxShadow: "0 20px 80px #0004" });
    const finish = (index: number) => { dialog.close(); dialog.remove(); onChoice(index); };
    if (options.title) {
      const heading = document.createElement("h3"); heading.textContent = options.title; heading.style.padding = "0 12px"; dialog.appendChild(heading);
    }
    options.options.forEach((label, index) => {
      const button = document.createElement("button"); button.textContent = label;
      Object.assign(button.style, { width: "100%", padding: "16px", margin: "3px 0", border: "none", borderRadius: "16px", font: "600 16px system-ui", cursor: "pointer", background: "#fff", color: index === options.destructiveButtonIndex ? "#B43E33" : "#1B1A17" });
      button.onclick = () => finish(index); dialog.appendChild(button);
    });
    dialog.oncancel = (event) => { event.preventDefault(); finish(options.cancelButtonIndex ?? -1); };
    dialog.onclick = (event) => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) finish(options.cancelButtonIndex ?? -1); } };
    document.body.appendChild(dialog); dialog.showModal();
  },
};

export const Share = {
  async share({ url, message }: { url?: string; message?: string }) {
    if (navigator.share) {
      try { await navigator.share({ url, text: message }); return; }
      catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
    }
    const value = url ?? message ?? "";
    try { await navigator.clipboard.writeText(value); window.alert("Link copied. You can paste it into a message."); }
    catch { window.prompt("Copy this link to share your app:", value); }
  },
};
