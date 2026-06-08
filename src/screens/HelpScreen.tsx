import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { SectionCard, Pill } from "@/components/ui/data-bits";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { BookOpen, Search, ExternalLink, Keyboard, Languages } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * SW ↔ EN glossary surfaced from the brief, with a search box. Helps anyone
 * new to the system map between the Swahili field terms and the English UI
 * labels.
 */
const GLOSSARY: { sw: string; en: string; note?: { sw: string; en: string } }[] = [
  { sw: "Mauzo", en: "Sales" },
  { sw: "Yaliyouzwa", en: "Sold" },
  { sw: "Mkopo", en: "Credit" },
  { sw: "Yaliyoharibika", en: "Spoilt" },
  { sw: "Yaliyobaki", en: "Closing" },
  { sw: "Wafugaji", en: "Farmers" },
  { sw: "Mtindi", en: "Cultured milk" },
  { sw: "Samli", en: "Ghee" },
  { sw: "Siagi", en: "Butter" },
  { sw: "Ghala", en: "Store" },
  { sw: "Hisa", en: "Stock" },
  { sw: "Ripoti", en: "Reports" },
  { sw: "Uzalishaji", en: "Production" },
  { sw: "Wateja", en: "Customers" },
  { sw: "Amana", en: "Deposit" },
  { sw: "Jumla", en: "Total" },
  { sw: "Funga Siku", en: "Day close" },
  { sw: "Madumu", en: "Jerrycans", note: { sw: "Vyombo vya plastiki", en: "Plastic containers" } },
  { sw: "Vikopo", en: "Cups", note: { sw: "Vikombe vya plastiki", en: "Disposable plastic cups" } },
  { sw: "Pointi", en: "Collection point" },
  { sw: "Maziwa fresh", en: "Fresh milk" },
  {
    sw: "Mzunguko",
    en: "Cycle",
    note: { sw: "Mzunguko wa siku 15 wa malipo", en: "15-day payment cycle" },
  },
  {
    sw: "Yield",
    en: "Yield",
    note: { sw: "Asilimia ya pato halisi vs maziwa ghafi", en: "Output as % of raw milk" },
  },
  {
    sw: "Spoilage",
    en: "Spoilage",
    note: { sw: "Bidhaa zilizoharibika au kupotea", en: "Damaged or lost product" },
  },
];

const SECTIONS: {
  id: string;
  title: { sw: string; en: string };
  blurb: { sw: string; en: string };
  link?: string;
}[] = [
  {
    id: "procurement",
    title: { sw: "Ununuzi (Procurement)", en: "Procurement" },
    blurb: {
      sw: "Maziwa kutoka kwa wafugaji wa kike, mzunguko wa malipo wa siku 15, vidhibiti vya ubora kwenye pointi za ukusanyaji.",
      en: "Milk from women smallholder farmers, 15-day payout cycle, quality checks at collection points.",
    },
    link: "/farmers",
  },
  {
    id: "movement",
    title: { sw: "Mwendo wa maziwa", en: "Milk movement" },
    blurb: {
      sw: "Kila siku, maziwa ghafi yanayoingia + yaliyotengenezwa = yaliyouzwa + yaliyotenganishwa + yaliyoharibika + yaliyobaki. Lazima ya hesabu ifungwe na Production Manager.",
      en: "Each day, raw + produced milk = sold + separated + spoilt + closing. Production Manager must lock the day before the next opens.",
    },
    link: "/reconciliation",
  },
  {
    id: "sales",
    title: { sw: "Njia za mauzo", en: "Sales channels" },
    blurb: {
      sw: "Mauzo ya kaunta, gari la njia (asubuhi/jioni), na mauzo ya mkopo wa mwezi kwa hoteli na mikahawa.",
      en: "Counter sales, route van (morning/evening), and monthly credit accounts for hotels and restaurants.",
    },
    link: "/pos",
  },
  {
    id: "credit",
    title: { sw: "Aina za wateja", en: "Customer types" },
    blurb: {
      sw: "Cash (kulipa moja kwa moja), Per-sale credit (kila mauzo ni mkopo wa peke yake), Monthly credit (mteja anachukua bidhaa mwezi mzima na kulipa kwa amana).",
      en: "Cash, Per-sale credit (each sale is its own credit line), Monthly credit (customer draws all month, settles with deposits).",
    },
    link: "/customers",
  },
  {
    id: "production",
    title: { sw: "Uzalishaji", en: "Production" },
    blurb: {
      sw: "Maziwa ghafi yanatengenezwa kuwa Mtindi, Yoghurt, Krimu, Jibini, Samli na Siagi. Yield inafuatiliwa kwa kila batch.",
      en: "Raw milk becomes Mtindi, Yoghurt, Cream, Cheese, Ghee, and Butter. Yield is tracked per batch.",
    },
    link: "/production",
  },
  {
    id: "rbac",
    title: { sw: "Majukumu (Roles)", en: "Roles" },
    blurb: {
      sw: "Admin, Finance, Production Manager, Sales/Counter, Route Worker, Store Keeper, Viewer. Mtumiaji anaweza kuwa na zaidi ya jukumu moja.",
      en: "Admin, Finance, Production Manager, Sales/Counter, Route Worker, Store Keeper, Viewer. Users can hold multiple roles at once.",
    },
    link: "/settings",
  },
];

const SHORTCUTS: { keys: string[]; sw: string; en: string }[] = [
  { keys: ["⌘", "K"], sw: "Fungua menyu ya amri", en: "Open command palette" },
  { keys: ["/"], sw: "Fungua menyu ya amri (haraka)", en: "Open command palette (fast)" },
  { keys: ["ESC"], sw: "Funga modali yoyote", en: "Close any modal" },
  { keys: ["TAB"], sw: "Pita kwenye vifaa", en: "Move between controls" },
];

export function HelpScreen() {
  const { t, lang } = useApp();
  const [q, setQ] = useState("");

  const filteredGlossary = useMemo(() => {
    if (!q) return GLOSSARY;
    const needle = q.toLowerCase();
    return GLOSSARY.filter(
      (g) =>
        g.sw.toLowerCase().includes(needle) ||
        g.en.toLowerCase().includes(needle) ||
        g.note?.sw.toLowerCase().includes(needle) ||
        g.note?.en.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <AppShell title={t("Msaada", "Help & glossary")}>
      <div
        className="rounded-3xl p-6 lg:p-8 text-white mb-6 shadow-elevated relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #14532D 0%, #1E7C3F 50%, #8CC63F 130%)" }}
      >
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              {t("Karibu kwenye msaada", "Welcome to the help center")}
            </h2>
            <p className="opacity-90 mt-1 max-w-2xl">
              {t(
                "Hapa utapata kamusi ya Kiswahili na Kiingereza, maelezo ya kazi za mfumo na njia za haraka za kibodi.",
                "Find the Swahili and English glossary, system overviews and keyboard shortcuts in one place.",
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-4 w-4" /> {t("Kamusi (SW ↔ EN)", "Glossary (SW ↔ EN)")}
            </span>
          }
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
                placeholder={t("Tafuta neno…", "Search a term…")}
              />
            </div>
          }
        >
          {filteredGlossary.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t("Hakuna maneno yanayolingana", "No matching terms")}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {filteredGlossary.map((g) => (
                <div
                  key={g.sw}
                  className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{g.sw}</div>
                    <div className="text-xs text-muted-foreground">{g.en}</div>
                    {g.note && (
                      <div className="text-[11px] text-muted-foreground mt-1 italic">
                        {lang === "sw" ? g.note.sw : g.note.en}
                      </div>
                    )}
                  </div>
                  <Pill tone="info">SW</Pill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="h-4 w-4" /> {t("Njia za kibodi", "Keyboard shortcuts")}
            </span>
          }
        >
          <ul className="space-y-2.5">
            {SHORTCUTS.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{lang === "sw" ? s.sw : s.en}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k, j) => (
                    <kbd
                      key={j}
                      className="rounded bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-mono font-semibold"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title={t("Mada za mfumo", "System topics")}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SECTIONS.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-border bg-card p-4 flex flex-col"
              >
                <div className="font-display font-semibold mb-1">
                  {lang === "sw" ? s.title.sw : s.title.en}
                </div>
                <p className="text-xs text-muted-foreground flex-1">
                  {lang === "sw" ? s.blurb.sw : s.blurb.en}
                </p>
                {s.link && (
                  <Link
                    to={s.link}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1E7C3F] hover:underline"
                  >
                    {t("Nenda", "Open")} <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
