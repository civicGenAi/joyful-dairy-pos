import { JoyLogo } from "@/components/brand/JoyLogo";
import { useApp } from "@/app/context";
import { usePublicCatalog } from "@/lib/data/hooks/catalog";
import type { CatalogProduct } from "@/lib/data/catalog";
import { tzs } from "@/lib/format";
import { MessageCircle, Globe, Instagram, Music2, Linkedin, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

// Public, no login: what a customer's phone opens after scanning the
// "our products" QR code, a different code and a different physical spot
// (packaging/storefront) than the /feedback QR (receipts, post-purchase).
// Backed by public_catalog(), the third anon-callable RPC in this schema.

const WHATSAPP_NUMBER = "255784240780";
const PAGE_SIZE = 6;

const SOCIAL_LINKS = [
  { href: "https://www.africanjoydairy.com/", icon: Globe, label: "africanjoydairy.com" },
  { href: "https://www.instagram.com/africanjoy_", icon: Instagram, label: "@africanjoy_" },
  { href: "https://www.tiktok.com/@africanjoy_", icon: Music2, label: "@africanjoy_" },
  {
    href: "https://www.linkedin.com/company/african-joy",
    icon: Linkedin,
    label: "African Joy",
  },
] as const;

const CATEGORY_LABEL: Record<string, { sw: string; en: string }> = {
  cultured: { sw: "Mtindi", en: "Cultured milk" },
  cheese: { sw: "Jibini", en: "Cheese" },
  yoghurt: { sw: "Yogati", en: "Yoghurt" },
  cream: { sw: "Krimu", en: "Cream" },
  ghee: { sw: "Samli", en: "Ghee" },
  butter: { sw: "Siagi", en: "Butter" },
};

function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function CatalogScreen() {
  const { t, lang } = useApp();
  const { data: products = [], isPending } = usePublicCatalog();
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Grouped for display, but truncated to `visible` products overall so a
  // long catalogue doesn't force a long scroll, "Load more" reveals the rest.
  const grouped = useMemo(() => {
    const map: Record<string, CatalogProduct[]> = {};
    for (const p of products.slice(0, visible)) {
      (map[p.category] ??= []).push(p);
    }
    return map;
  }, [products, visible]);

  const generalMessage = t(
    "Habari, ningependa kuuliza kuhusu bidhaa zenu.",
    "Hello, I'd like to ask about your products.",
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex justify-center mb-2">
            <JoyLogo />
          </div>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1E7C3F] mb-5">
            Drink, Eat, Enjoy
          </p>
          <h1 className="font-display text-lg font-bold text-center">
            {t("Bidhaa zetu", "Our products")}
          </h1>
          <p className="text-muted-foreground text-sm text-center mt-1 mb-6">
            {t(
              "Angalia bidhaa zetu na uagize moja kwa moja kwa WhatsApp.",
              "Browse our products and order directly on WhatsApp.",
            )}
          </p>

          {isPending ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              {t("Inapakia…", "Loading…")}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              {t("Bidhaa hazipatikani kwa sasa.", "No products available right now.")}
            </div>
          ) : (
            <>
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
                                <div className="text-xs text-muted-foreground truncate">
                                  {p.swName}
                                </div>
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

              {visible < products.length && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-border py-2.5 mt-4 text-sm font-semibold text-[#1E7C3F] hover:bg-[#1E7C3F]/10"
                >
                  <ChevronDown className="h-4 w-4" />
                  {t("Onyesha zaidi", "Load more")}
                </button>
              )}
            </>
          )}

          <p className="text-center text-[11px] text-muted-foreground mt-8">
            {t(
              "African Joy Dairy, Arusha. Bei zinaweza kubadilika.",
              "African Joy Dairy, Arusha. Prices may vary.",
            )}
          </p>
        </div>

        <div className="sticky top-6 shrink-0 flex flex-col gap-2.5 sm:gap-3">
          <a
            href={waLink(generalMessage)}
            target="_blank"
            rel="noopener noreferrer"
            title={t("Ongea nasi kwa WhatsApp", "Chat with us on WhatsApp")}
            className="grid h-11 w-11 sm:h-14 sm:w-14 place-items-center rounded-full text-white shadow-elevated"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </a>
          {SOCIAL_LINKS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                className="grid h-11 w-11 sm:h-14 sm:w-14 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-[#1E7C3F] hover:border-[#1E7C3F] transition shadow-card"
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
