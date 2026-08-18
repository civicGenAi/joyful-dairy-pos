import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Renders a QR code to a data: URI PNG, not a live <canvas>/<svg>, so the
 *  PDF export (which rasterizes the DOM as-is) always captures it reliably
 *  regardless of timing. */
export function useQrDataUrl(text: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(text, {
      margin: 1,
      width: 180,
      color: { dark: "#14532D", light: "#FFFFFF" },
    })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return url;
}
