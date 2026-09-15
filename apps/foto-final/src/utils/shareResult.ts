export interface ShareAdapters {
  readonly nativeShare?: (text: string) => Promise<void>;
  readonly copyText?: (text: string) => Promise<void>;
}

export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareResultText(
  text: string,
  adapters: ShareAdapters,
): Promise<ShareOutcome> {
  if (adapters.nativeShare) {
    try {
      await adapters.nativeShare(text);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
    }
  }

  if (adapters.copyText) {
    try {
      await adapters.copyText(text);
      return "copied";
    } catch {
      // El texto queda visible para copia manual.
    }
  }

  return "manual";
}
