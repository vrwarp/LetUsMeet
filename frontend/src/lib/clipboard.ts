/**
 * Copies text to the clipboard with resilience for insecure/older contexts.
 *
 * Tries the async Clipboard API first (only available in secure contexts), then
 * falls back to a hidden textarea + document.execCommand("copy"). Resolves true
 * only when the copy actually succeeded so callers can gate their "Copied!"
 * success state on a real result instead of optimistically flipping it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Clipboard writeText failed, trying fallback:", err);
    }
  }

  return copyWithExecCommand(text);
}

function copyWithExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    console.error("Clipboard execCommand fallback failed:", err);
    return false;
  }
}
