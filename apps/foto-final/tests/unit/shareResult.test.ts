import { describe, expect, it, vi } from "vitest";

import { shareResultText } from "../../src/utils/shareResult";

describe("compartir resultados", () => {
  it("prioriza Web Share cuando está disponible", async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const copyText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResultText("reto meme", { nativeShare, copyText }),
    ).resolves.toBe("shared");
    expect(nativeShare).toHaveBeenCalledWith("reto meme");
    expect(copyText).not.toHaveBeenCalled();
  });

  it("copia al portapapeles si Web Share falla", async () => {
    const nativeShare = vi.fn().mockRejectedValue(new Error("no disponible"));
    const copyText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResultText("reto meme", { nativeShare, copyText }),
    ).resolves.toBe("copied");
    expect(copyText).toHaveBeenCalledWith("reto meme");
  });

  it("usa directamente el portapapeles si Web Share no existe", async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);

    await expect(shareResultText("reto meme", { copyText })).resolves.toBe(
      "copied",
    );
  });

  it("mantiene el texto visible para copia manual si no puede compartir", async () => {
    const copyText = vi.fn().mockRejectedValue(new Error("bloqueado"));

    await expect(shareResultText("reto meme", { copyText })).resolves.toBe(
      "manual",
    );
  });

  it("respeta la cancelación del diálogo nativo", async () => {
    const nativeShare = vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelado", "AbortError"));
    const copyText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResultText("reto meme", { nativeShare, copyText }),
    ).resolves.toBe("cancelled");
    expect(copyText).not.toHaveBeenCalled();
  });
});
