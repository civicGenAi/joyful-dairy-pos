import { JoyLogo } from "@/components/brand/JoyLogo";
import { useApp } from "@/app/context";
import { usePublicCatalog } from "@/lib/data/hooks/catalog";
import type { CatalogProduct } from "@/lib/data/catalog";
import { tzs } from "@/lib/format";
import { MessageCircle } from "lucide-react";
import { useMemo } from "react";

// Public, no login: what a customer's phone opens after scanning the
// "our products" QR code, a different code and a different physical spot
// (packaging/storefront) than the /feedback QR (receipts, post-purchase).
// Backed by public_catalog(), the third anon-callable RPC in this schema.

const WHATSAPP_NUMBER = "255784240780";

const CATEGORY_LABEL: Record<string, { sw: string; en: string }> = {
  cultured: { sw: "Mtindi", en: "Cultured milk" },
  cheese: { sw: "Jibini", en: "Cheese" },
  yoghurt: { sw: "Yogati", en: "Yoghurt" },
};

function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function CatalogScreen() {
  const { t, lang } = useApp();
  const { data: products = [], isPending } = usePublicCatalog();

  const grouped = useMemo(() => {
    const map: Record<string, CatalogProduct[]> = {};
    for (const p of products) {
      (map[p.category] ??= []).push(p);
    }
    return map;
  }, [products]);

  const generalMessage = t(
    "Habari, ningependa kuuliza kuhusu bidhaa zenu.",
    "Hello, I'd like to ask about your products.",
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-5">
          <JoyLogo />
        </div>
        <h1 className="font-display text-lg font-bold text-center">
          {t("Bidhaa zetu", "Our products")}
        </h1>
        <p className="text-muted-foreground text-sm text-center mt-1 mb-5">
          {t(
            "Angalia bidhaa zetu na uagize moja kwa moja kwa WhatsApp.",
            "Browse our products and order directly on WhatsApp.",
          )}
        </p>

        <a
          href={waLink(generalMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white mb-6"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <MessageCircle className="h-4 w-4" />
          {t("Ongea nasi kwa WhatsApp", "Chat with us on WhatsApp")}
        </a>

        {isPending ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            {t("Inapakia…", "Loading…")}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            {t("Bidhaa hazipatikani kwa sasa.", "No products available right now.")}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {CATEGORY_LABEL[category]?.[lang] ?? category}
                </div>
                <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                  {items.map((p) => {
                    const orderMessage = t(
                      `Habari, ningependa kuagiza: ${p.swName || p.name}`,
                      `Hello, I'd like to order: ${p.name}`,
                    );
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          {p.swName && p.swName !== p.name && (
                            <div className="text-xs text-muted-foreground truncate">{p.swName}</div>
                          )}
                          {p.priceTZS > 0 && (
                            <div className="font-num text-sm font-semibold text-[#1E7C3F] mt-0.5">
                              {tzs(p.priceTZS)} / {p.unit}
                            </div>
                          )}
                        </div>
                        <a
                          href={waLink(orderMessage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-lg border border-[#1E7C3F] text-[#1E7C3F] px-3 py-1.5 text-xs font-semibold hover:bg-[#1E7C3F]/10"
                        >
                          {t("Agiza", "Order")}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          {t(
            "African Joy Dairy, Arusha. Bei zinaweza kubadilika.",
            "African Joy Dairy, Arusha. Prices may vary.",
          )}
        </p>
      </div>
    </div>
  );
}
