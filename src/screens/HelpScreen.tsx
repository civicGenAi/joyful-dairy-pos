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
    note: { sw: "Mzunguko wa malipo kila mwezi", en: "Monthly payment cycle" },
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
      sw: "Maziwa kutoka kwa wafugaji wa kike, mzunguko wa malipo kila mwezi, vidhibiti vya ubora kwenye pointi za ukusanyaji.",
      en: "Milk from women smallholder farmers, monthly payout cycle, quality checks at collection points.",
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

/**
 * The step-by-step user guide. Bilingual; rendered as accordions so each
 * role finds its daily flow without scrolling through everything.
 */
const GUIDE: {
  id: string;
  title: { sw: string; en: string };
  steps: { sw: string; en: string }[];
}[] = [
  {
    id: "signin",
    title: { sw: "Kuingia na usalama wa akaunti", en: "Signing in & account security" },
    steps: [
      {
        sw: "Ingia kwa barua pepe na nenosiri ulilopewa na admin. Ukiwasha 2FA, utaombwa namba ya tarakimu 6 kutoka programu yako ya uthibitisho kila unapoingia.",
        en: "Sign in with the email and password your admin gave you. If you enabled 2FA, every sign-in also asks for the 6-digit code from your authenticator app.",
      },
      {
        sw: "Akaunti inaruhusu vifaa 2 tu kwa wakati mmoja. Kifaa cha tatu kitakuomba utoe kimojawapo kabla ya kuendelea.",
        en: "An account allows only 2 active devices. A third device asks you to sign one of the others out before continuing.",
      },
      {
        sw: "Mfumo ukikaa dakika 30 bila kutumika unakutoa wenyewe; ingia tena.",
        en: "After 30 minutes of inactivity the system signs you out automatically; just sign in again.",
      },
      {
        sw: "Ukipoteza simu yenye 2FA, tumia mojawapo ya namba za uokoaji ulizopakua; itazima 2FA ili uingie na kuiwasha upya.",
        en: "If you lose your 2FA phone, use one of the recovery codes you downloaded; it resets 2FA so you can sign in and re-enable it.",
      },
    ],
  },
  {
    id: "intake",
    title: { sw: "Kukusanya maziwa (Wafugaji)", en: "Daily milk intake (Farmers)" },
    steps: [
      {
        sw: "Wafugaji > Rekodi ukusanyaji: chagua mfugaji, kipindi (asubuhi/jioni), litre na pointi. Mfumo unakataa kipindi kisicholingana na saa halisi.",
        en: "Farmers > Record collection: pick the farmer, session (morning/evening), litres and point. The system rejects a session that does not match the real clock.",
      },
      {
        sw: "Salio la mfugaji linaongezeka lenyewe: litre x bei yake. Halibadilishwi kwa mkono; marekebisho yanaombwa na kuidhinishwa na admin.",
        en: "The farmer balance grows automatically: litres x their rate. It is never typed by hand; adjustments are requested and approved by an admin.",
      },
      {
        sw: "Pointi za ukusanyaji zinaongezwa, kuhaririwa na kusimamishwa kwenye skrini ya Pointi (au Mipangilio > Maeneo, ni orodha ileile).",
        en: "Collection points are added, edited and suspended on the Collection points screen (or Settings > Locations, it is the same list).",
      },
    ],
  },
  {
    id: "van",
    title: { sw: "Siku ya gari la njia (Dereva)", en: "The van day (Driver)" },
    steps: [
      {
        sw: "Pakia: ondoa tiki bidhaa usizonazo, jaza idadi za ulizonazo, thibitisha. Zisizochaguliwa zinaondolewa kwenye siku yako.",
        en: "Load: untick products you do not have, fill quantities for what you do, confirm. Unselected products disappear from your day.",
      },
      {
        sw: "Uza: chagua mteja, gusa bidhaa, chagua malipo (cash, mkopo, M-Pesa). Unaweza kubadili mpangilio wa bidhaa (gridi au orodha).",
        en: "Sell: pick the customer, tap products, choose payment (cash, credit, M-Pesa). You can switch the product layout (grid or list).",
      },
      {
        sw: "Marejesho yanahesabiwa otomatiki (kilichopakiwa kasoro kilichouzwa). Ukibadilisha namba lazima utoe sababu.",
        en: "Returns are computed automatically (loaded minus sold). Changing a number requires a reason.",
      },
      {
        sw: "Fungasa: weka cash benki, pakia picha ya risiti ya benki (ni lazima kwa cash), kisha tengeneza risiti ya amana.",
        en: "Cash-up: bank the cash, upload the deposit-slip photo (mandatory for cash), then generate the deposit receipt.",
      },
    ],
  },
  {
    id: "customers",
    title: { sw: "Wateja, mikopo na vikumbusho", en: "Customers, credit & reminders" },
    steps: [
      {
        sw: "Aina tatu: Cash, Mkopo (kila mauzo peke yake) na Mkopo wa mwezi. Wateja wa mkopo wanaweza kuwekewa barua pepe na tarehe ya malipo.",
        en: "Three types: Cash, Per-sale credit and Monthly credit. Credit customers can have an email and a payment due date.",
      },
      {
        sw: "Tarehe ya malipo ikiwekwa, mfumo unatuma barua pepe siku 5 kabla na siku yenyewe, saa 7 asubuhi (EAT), bila kuingilia mtu.",
        en: "With a due date set, the system emails the customer 5 days before and on the day itself, at 07:00 EAT, automatically.",
      },
      {
        sw: "Amana ya mteja inapunguza deni lake mara moja; risiti inapata namba ya mfumo (AJD-DEP-tarehe-namba).",
        en: "A customer deposit reduces their balance immediately; the receipt gets a system reference (AJD-DEP-date-number).",
      },
    ],
  },
  {
    id: "stock",
    title: { sw: "Stock, ghala na kiwango cha kuagiza", en: "Stock, store & the reorder level" },
    steps: [
      {
        sw: "Kiwango cha kuagiza (reorder): idadi ya chini kabla ya kuagiza upya. Bidhaa ikifikia au kushuka chini yake, inaonekana 'Chini' na inaingia kwenye arifa.",
        en: "Reorder level: the minimum before you restock. When an item reaches or drops below it, it shows 'Low' and appears in the alerts.",
      },
      {
        sw: "Idadi inayopatikana haibadilishwi kwa mkono kamwe; inabadilika kupitia kupokea, kutoa, kurekebisha, mauzo na marejesho (daftari moja la harakati).",
        en: "On-hand is never typed directly; it changes only through receive, issue, adjust, sales and returns (one movements ledger).",
      },
      {
        sw: "Malighafi na vifaa vya ghala vinaongezwa, kuhaririwa na kusimamishwa kwenye skrini ya Stock. Kusimamisha kunaficha bidhaa bila kufuta historia.",
        en: "Raw and consumable items are added, edited and suspended on the Stock screen. Suspending hides an item without deleting its history.",
      },
    ],
  },
  {
    id: "production",
    title: { sw: "Uzalishaji na kufunga siku", en: "Production & day close" },
    steps: [
      {
        sw: "Rekodi kila batch: bidhaa, litre za maziwa ghafi zilizotumika na pato. Yield inahesabiwa na kufuatiliwa kwenye grafu.",
        en: "Record every batch: the product, raw litres used and the output. Yield is computed and tracked on the chart.",
      },
      {
        sw: "'Mpango wa kuzalisha leo' ni mapendekezo ya uwiano wa kiwanda (mfano Mozzarella: 244 L = 20 kg); 'Stock sasa' ni idadi halisi.",
        en: "'To produce today' shows the plant's standard ratios (e.g. Mozzarella: 244 L = 20 kg); 'Now' is the live stock figure.",
      },
      {
        sw: "Mwisho wa siku, Production Manager anafunga siku kwenye Ulinganisho: maziwa yaliyoingia lazima yalingane na yaliyotoka (mauzo + uzalishaji + yaliyoharibika + yaliyobaki).",
        en: "At day end the Production Manager locks the day in Reconciliation: milk in must equal milk out (sales + production + spoilage + closing).",
      },
    ],
  },
  {
    id: "finance",
    title: { sw: "Fedha: amana, matumizi na malipo", en: "Finance: deposits, expenses & payouts" },
    steps: [
      {
        sw: "Kila amana na matumizi yanapata namba ya mfumo inayofuatilika: AJD-DEP-tarehe-namba au AJD-EXP-tarehe-namba. Tafuta kwa namba hiyo wakati wowote.",
        en: "Every deposit and expense gets a traceable system reference: AJD-DEP-date-number or AJD-EXP-date-number. Search by it any time.",
      },
      {
        sw: "Nakala ngumu (risiti za benki, ankara) zinapakiwa na kuonekana kwa alama ya kibanio; chuja 'Zenye risiti' kuona zote.",
        en: "Hard copies (bank slips, invoices) are uploaded and shown with a paperclip; filter 'With receipts' to review them all.",
      },
      {
        sw: "Malipo ya wafugaji yanafanyika kwa mzunguko; kulipa kunafuta salio na kuanzisha mzunguko mpya, kila hatua ikirekodiwa.",
        en: "Farmer payouts run per cycle; paying clears balances and opens the next cycle, with every step audited.",
      },
    ],
  },
  {
    id: "admin",
    title: { sw: "Kazi za Admin", en: "Admin tasks" },
    steps: [
      {
        sw: "Mipangilio > Watumiaji: unda watumiaji kwa majukumu yao, simamisha/rudisha, badilisha nenosiri, futa. Kadri ya ruhusa, ndivyo tabo zinavyoonekana.",
        en: "Settings > Users: create users with their roles, suspend/reinstate, change passwords, delete. Permissions decide which tabs each user sees.",
      },
      {
        sw: "Idhinisha maombi ya marekebisho ya salio kwenye skrini ya Wafugaji.",
        en: "Approve balance-adjustment requests on the Farmers screen.",
      },
      {
        sw: "Daftari la ukaguzi (Mipangilio > Ukaguzi) linaonyesha kila tendo: nani, lini, kifaa gani na IP gani.",
        en: "The audit trail (Settings > Audit) shows every action: who, when, on which device and IP.",
      },
    ],
  },
  {
    id: "trouble",
    title: { sw: "Hitilafu za kawaida na afya ya mfumo", en: "Troubleshooting & system health" },
    steps: [
      {
        sw: "Kitu kikionekana hakifanyi kazi, fungua ukurasa wa Afya ya mfumo (/status). Unakagua hifadhidata, huduma za barua pepe, hifadhi ya mafaili na uadilifu wa data, na kukuambia pa kuangalia.",
        en: "If something seems broken, open the System health page (/status). It probes the database, email service, file storage and data integrity, and tells you where to look.",
      },
      {
        sw: "'Kipindi hakilingani': unajaribu kurekodi asubuhi wakati ni jioni (au kinyume). 'Siku imefungwa': siku ilishafungwa kwenye Ulinganisho.",
        en: "'Session mismatch': you are recording morning during the evening (or vice versa). 'Day locked': that day was already closed in Reconciliation.",
      },
      {
        sw: "'Mteja ana deni lililochelewa': mkopo umezuiliwa hadi alipe au admin abadilishe hali yake.",
        en: "'Customer is overdue': further credit is blocked until they pay or an admin clears the status.",
      },
      {
        sw: "Barua pepe hazitoki? Hakikisha send-reminder imetumwa (deploy) na RESEND_API_KEY imewekwa; ukurasa wa /status unaonyesha hali yake.",
        en: "Emails not going out? Make sure send-reminder is deployed and RESEND_API_KEY is set; the /status page shows its state.",
      },
    ],
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

      <div className="mb-4">
        <SectionCard
          title={
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> {t("Mwongozo wa watumiaji", "User guide")}
            </span>
          }
        >
          <div className="grid gap-2">
            {GUIDE.map((g) => (
              <details key={g.id} className="group rounded-xl border border-border bg-card">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold list-none">
                  {lang === "sw" ? g.title.sw : g.title.en}
                  <span className="text-muted-foreground transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <ol className="px-4 pb-4 space-y-2">
                  {g.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white mt-0.5"
                        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">
                        {lang === "sw" ? step.sw : step.en}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </SectionCard>
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
