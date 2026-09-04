import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/finance (was @/mock/data).
import type { ExpenseCategory } from "@/mock/data";
import {
  useExpenses,
  useCreateExpense,
  useExpenseCategories,
  useExpenseSites,
} from "@/lib/data/hooks/finance";
import { useExpenseMonthBalance, useSetExpenseOpening } from "@/lib/data/hooks/mpesaDaily";
import { uploadHardCopy } from "@/lib/data/uploads";
import { todayISO } from "@/lib/data/dates";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Banknote,
  Smartphone,
  ArrowUpRight,
  Receipt,
  Fuel,
  Box,
  Wrench,
  Users,
  Zap,
  Truck,
  Briefcase,
  HelpCircle,
  Paperclip,
  Factory,
  Crown,
  Sprout,
  MapPin,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftNotice } from "@/components/ui/DraftNotice";

const CATEGORY_META: Record<string, { icon: typeof Fuel; sw: string; en: string; color: string }> =
  {
    fuel: { icon: Fuel, sw: "Mafuta", en: "Fuel", color: "#1E7C3F" },
    packaging: { icon: Box, sw: "Vifungashio", en: "Packaging", color: "#2F9E44" },
    repairs: { icon: Wrench, sw: "Marekebisho", en: "Repairs", color: "#E5A100" },
    wages: { icon: Users, sw: "Mishahara", en: "Wages", color: "#6FBF59" },
    utilities: { icon: Zap, sw: "Huduma", en: "Utilities", color: "#8CC63F" },
    transport: { icon: Truck, sw: "Usafiri", en: "Transport", color: "#1D9E75" },
    office: { icon: Briefcase, sw: "Ofisi", en: "Office", color: "#14532D" },
    other: { icon: HelpCircle, sw: "Nyingine", en: "Other", color: "#6B776E" },
  };
// A custom, staff-typed category has no icon/color polish assigned to it,
// falls back to a plain receipt icon and its own literal text as the label.
const DEFAULT_CATEGORY_META = { icon: Receipt, sw: "", en: "", color: "#6B776E" };
function categoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? DEFAULT_CATEGORY_META;
}
function categoryLabel(cat: string, lang: "sw" | "en") {
  const meta = CATEGORY_META[cat];
  return meta ? (lang === "sw" ? meta.sw : meta.en) : cat;
}

// Which part of the business an expense belongs to. Kiwanda is the main
// plant, Madam is the owner's own spending, Shamba is the farm. A site
// staff add themselves gets a plain pin icon and its own literal name.
const SITE_META: Record<string, { icon: typeof Factory; sw: string; en: string; color: string }> = {
  kiwanda: { icon: Factory, sw: "Kiwanda", en: "Kiwanda (main plant)", color: "#1E7C3F" },
  madam: { icon: Crown, sw: "Madam", en: "Madam (owner)", color: "#E5A100" },
  shamba: { icon: Sprout, sw: "Shamba", en: "Shamba (farm)", color: "#8CC63F" },
};
const UNASSIGNED = "__unassigned__";
function siteMeta(site: string) {
  return SITE_META[site] ?? { icon: MapPin, sw: "", en: "", color: "#6B776E" };
}
function siteLabel(site: string, lang: "sw" | "en") {
  const meta = SITE_META[site];
  return meta ? (lang === "sw" ? meta.sw : meta.en) : site;
}

export function ExpensesScreen() {
  const { t, lang, can } = useApp();
  const { data: expenses = [], isPending } = useExpenses();
  const { data: categories = [] } = useExpenseCategories();
  const { data: sites = [] } = useExpenseSites();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");
  const [site, setSite] = useState<string>("all");

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        if (cat !== "all" && e.category !== cat) return false;
        if (site !== "all" && (e.site ?? UNASSIGNED) !== site) return false;
        if (q) {
          const needle = q.toLowerCase();
          const text =
            `${e.vendor} ${e.description} ${e.ref ?? ""} ${e.refNo ?? ""} ${e.invoiceRef ?? ""}`.toLowerCase();
          if (!text.includes(needle)) return false;
        }
        return true;
      }),
    [expenses, q, cat, site],
  );

  const total = expenses.reduce((a, e) => a + e.amountTZS, 0);
  // The expense book runs like a float: money in hand at the start of the
  // month, spending against it, and whatever is left carries into the next
  // month. Without the opening figure a month always looked as though it
  // started from nothing.
  const thisMonth = todayISO().slice(0, 7);
  const balanceSite = site === "all" || site === UNASSIGNED ? "all" : site;
  const { data: monthBal } = useExpenseMonthBalance(thisMonth, balanceSite);
  const todayIso = todayISO();
  const today = expenses.filter((e) => e.date === todayIso).reduce((a, e) => a + e.amountTZS, 0);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) map[e.category] = (map[e.category] ?? 0) + e.amountTZS;
    return Object.entries(map).map(([category, value]) => ({
      category,
      value,
      label: categoryLabel(category, lang),
      color: categoryMeta(category).color,
    }));
  }, [expenses, lang]);

  // One row per site with its own total, plus whatever was recorded before
  // sites existed grouped under "Unassigned" (never folded into a real
  // site's number), so the parts always add back up to the grand total.
  const bySite = useMemo(() => {
    const totals: Record<string, { total: number; count: number }> = {};
    for (const key of sites) totals[key] = { total: 0, count: 0 };
    for (const e of expenses) {
      const key = e.site ?? UNASSIGNED;
      const row = (totals[key] ??= { total: 0, count: 0 });
      row.total += e.amountTZS;
      row.count += 1;
    }
    return Object.entries(totals)
      .filter(([key, v]) => key !== UNASSIGNED || v.count > 0)
      .map(([key, v]) => ({ site: key, ...v }));
  }, [expenses, sites]);

  if (isPending) {
    return (
      <AppShell title={t("Matumizi", "Expenses")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={6} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Matumizi", "Expenses")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Jumla mwezi", "Total this month")}
          value={tzs(total)}
          sub={`${expenses.length} ${t("rekodi", "entries")}`}
          accent="amber"
        />
        <StatCard
          label={t("Leo", "Today")}
          value={tzs(today)}
          sub={`${expenses.filter((e) => e.date === todayIso).length} ${t("rekodi", "entries")}`}
          accent="red"
        />
        <StatCard
          label={t("Kategoria kuu", "Top category")}
          value={byCategory.sort((a, b) => b.value - a.value)[0]?.label ?? "-"}
          sub={tzs(byCategory.sort((a, b) => b.value - a.value)[0]?.value ?? 0)}
          accent="info"
        />
        <StatCard
          label={t("Mauzaji", "Vendors")}
          value={new Set(expenses.map((e) => e.vendor)).size}
          accent="green"
        />
      </div>

      {monthBal && (
        <SectionCard
          title={t(`Salio la mwezi ${thisMonth}`, `Month balance, ${thisMonth}`)}
          className="mb-5"
          action={<SetOpeningSheet month={thisMonth} site={balanceSite} balance={monthBal} />}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("Salio la kuanzia", "Opening balance")}
              </div>
              <div className="font-num font-bold text-lg mt-0.5">{tzs(monthBal.opening)}</div>
              {!monthBal.isSet && (
                <div className="text-[11px] text-[#8a5a00] mt-1">
                  {t("Halijawekwa bado", "Not set yet")}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("Kimetumika", "Spent")}
              </div>
              <div className="font-num font-bold text-lg mt-0.5 text-[#E11B22]">
                {tzs(monthBal.spent)}
              </div>
            </div>
            <div
              className="rounded-xl border-2 p-3 bg-[#F4F6F2]"
              style={{ borderColor: "#1E6B3A" }}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("Salio la kubaki", "Closing balance")}
              </div>
              <div className="font-num font-bold text-lg mt-0.5">{tzs(monthBal.closing)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {t("Linaendelea mwezi ujao", "Carries into next month")}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t("Matumizi kwa mahali", "Spend by place")}
          </span>
        }
        className="mb-5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {bySite.map(({ site: key, total: siteTotal, count }) => {
            const meta = siteMeta(key);
            const Icon = meta.icon;
            const active = site === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSite(active ? "all" : key)}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? "border-[#1E7C3F] bg-[#1E7C3F]/5" : "border-border hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  {key === UNASSIGNED ? t("Hayajapangwa", "Unassigned") : siteLabel(key, lang)}
                </div>
                <div className="font-num font-bold text-lg mt-0.5">{tzs(siteTotal)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {count} {t("rekodi", "entries")}
                </div>
              </button>
            );
          })}
        </div>
        <div
          className="mt-3 rounded-xl border-2 p-3.5 flex items-center justify-between bg-[#F4F6F2]"
          style={{ borderColor: "#1E6B3A" }}
        >
          <span className="text-sm font-semibold">{t("Jumla kuu", "Grand total")}</span>
          <span className="font-num font-bold text-lg">{tzs(total)}</span>
        </div>
        {site !== "all" && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {t(
              "Orodha hapo chini inaonyesha mahali ulipochagua tu, bonyeza tena kuondoa kichujio.",
              "The list below is filtered to the selected place, click it again to clear.",
            )}
          </div>
        )}
      </SectionCard>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">{t("Orodha", "List")}</TabsTrigger>
          <TabsTrigger value="charts">{t("Chati", "Charts")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <SectionCard
            title={t("Matumizi yote", "All expenses")}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-8 w-44 pl-8 text-xs"
                    placeholder={t("Tafuta…", "Search…")}
                  />
                </div>
                <Select value={cat} onValueChange={(v) => setCat(v as ExpenseCategory | "all")}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Kategoria zote", "All categories")}</SelectItem>
                    {categories.map((k) => (
                      <SelectItem key={k} value={k}>
                        {categoryLabel(k, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={site} onValueChange={setSite}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Mahali pote", "All places")}</SelectItem>
                    {sites.map((k) => (
                      <SelectItem key={k} value={k}>
                        {siteLabel(k, lang)}
                      </SelectItem>
                    ))}
                    <SelectItem value={UNASSIGNED}>{t("Hayajapangwa", "Unassigned")}</SelectItem>
                  </SelectContent>
                </Select>
                <ExportMenu
                  formats={["csv", "excel", "pdf"]}
                  filename="expenses"
                  data={() => ({
                    title: t("Matumizi", "Expenses"),
                    headers: [
                      "Ref",
                      "Date",
                      "Category",
                      "Place",
                      "Vendor",
                      "Description",
                      "Invoice",
                      "Method",
                      "Amount TZS",
                    ],
                    rows: filtered.map((e) => [
                      e.refNo ?? "",
                      e.date,
                      e.category,
                      e.site ?? "",
                      e.vendor,
                      e.description,
                      e.invoiceRef ?? "",
                      e.method,
                      e.amountTZS,
                    ]),
                  })}
                />
                {can("finance:write") && <AddExpenseSheet />}
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t("Hakuna matumizi", "No matching expenses")}
                description={t(
                  "Badilisha kichujio au ongeza matumizi mapya.",
                  "Adjust the filter or add a new expense.",
                )}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                    <th>{t("Kategoria", "Category")}</th>
                    <th>{t("Mahali", "Place")}</th>
                    <th>{t("Muuzaji", "Vendor")}</th>
                    <th>{t("Maelezo", "Description")}</th>
                    <th>{t("Njia", "Method")}</th>
                    <th className="text-right">{t("Kiasi", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const meta = categoryMeta(e.category);
                    const Icon = meta.icon;
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="py-2.5 px-3 font-num text-xs text-muted-foreground whitespace-nowrap">
                          {e.date}
                        </td>
                        <td className="py-2.5">
                          <Pill tone="info">
                            <Icon className="h-3 w-3" />
                            {categoryLabel(e.category, lang)}
                          </Pill>
                        </td>
                        <td className="py-2.5">
                          {e.site ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              {(() => {
                                const SiteIcon = siteMeta(e.site).icon;
                                return (
                                  <SiteIcon
                                    className="h-3 w-3"
                                    style={{ color: siteMeta(e.site).color }}
                                  />
                                );
                              })()}
                              {siteLabel(e.site, lang)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 font-medium">{e.vendor}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {e.description}
                          <div className="font-num text-[10px] flex items-center gap-1.5 flex-wrap">
                            {e.refNo && <span className="text-[#1E7C3F]">{e.refNo}</span>}
                            {e.invoiceRef && (
                              <span>
                                {t("Ankara", "Inv")}: {e.invoiceRef}
                              </span>
                            )}
                            {e.ref && <span>{e.ref}</span>}
                            {e.attachmentUrl && (
                              <a
                                href={e.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={t("Nakala ngumu", "Hard copy")}
                                className="text-[#1E7C3F] hover:opacity-70"
                              >
                                <Paperclip className="h-3 w-3 inline" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs capitalize">
                            {e.method === "cash" ? (
                              <Banknote className="h-3 w-3" />
                            ) : e.method === "mpesa" ? (
                              <Smartphone className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {e.method}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-num font-semibold text-[#E11B22]">
                          -{tzs(e.amountTZS)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={6} className="py-3 px-3 font-semibold">
                      {t("Jumla", "Total")}
                    </td>
                    <td className="py-3 text-right font-num font-bold">
                      {tzs(filtered.reduce((a, e) => a + e.amountTZS, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <SectionCard title={t("Matumizi kwa kategoria", "Expenses by category")}>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {byCategory.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => tzs(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={t("Mlolongo wa matumizi", "Spend trend")}>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart
                    data={byCategory.map((d) => ({ name: d.label, value: d.value }))}
                    margin={{ left: -10 }}
                  >
                    <CartesianGrid stroke="#E6EBE1" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B776E" fontSize={11} />
                    <YAxis
                      stroke="#6B776E"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v: number) => tzs(v)} />
                    <Bar dataKey="value" fill="#2F9E44" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// Setting the opening balance. The figure people actually want is last
// month's closing, so it is offered as one click rather than left to be
// looked up and retyped.
function SetOpeningSheet({
  month,
  site,
  balance,
}: {
  month: string;
  site: string;
  balance: { opening: number; suggestedOpening: number; previousMonth: string; isSet: boolean };
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">(balance.opening || "");
  const [note, setNote] = useState("");
  const save = useSetExpenseOpening();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          {balance.isSet
            ? t("Badilisha salio la kuanzia", "Change opening balance")
            : t("Weka salio la kuanzia", "Set opening balance")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Salio la kuanzia", "Opening balance")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Hii ni fedha uliyokuwa nayo mwanzoni mwa mwezi, kabla ya matumizi ya mwezi huu.",
              "This is the money you had in hand at the start of the month, before this month's spending.",
            )}
          </div>

          <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold">
                {t(
                  `Salio la mwisho la ${balance.previousMonth}`,
                  `Closing balance for ${balance.previousMonth}`,
                )}
              </div>
              <div className="font-num font-bold">{tzs(balance.suggestedOpening)}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              onClick={() => setAmount(balance.suggestedOpening)}
            >
              {t("Tumia hii", "Use this")}
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
            <Input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="font-num"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo (hiari)", "Note (optional)")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            disabled={amount === "" || save.isPending}
            onClick={() =>
              save.mutate(
                { month, site, amount: Number(amount), note: note || undefined },
                {
                  onSuccess: () => {
                    toast.success(t("Imehifadhiwa", "Saved"));
                    setOpen(false);
                  },
                  onError: () => toast.error(t("Imeshindikana", "Could not save it")),
                },
              )
            }
          >
            {save.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const NEW_CATEGORY = "__new__";
const NEW_SITE = "__new_site__";

function AddExpenseSheet() {
  const { t, lang } = useApp();
  const { data: categories = [] } = useExpenseCategories();
  const { data: sites = [] } = useExpenseSites();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<string>("fuel");
  const [newCategory, setNewCategory] = useState("");
  const [site, setSite] = useState<string>("kiwanda");
  const [newSite, setNewSite] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("cash");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const create = useCreateExpense();

  // Autosaved while open: an expense with a long description is exactly
  // the kind of entry nobody wants to type twice.
  const draft = useFormDraft({
    key: "add-expense",
    enabled: open,
    value: {
      date,
      category,
      newCategory,
      site,
      newSite,
      vendor,
      description,
      amount,
      method,
      invoiceRef,
    },
    onRestore: (v) => {
      setDate(v.date);
      setCategory(v.category);
      setNewCategory(v.newCategory);
      setSite(v.site);
      setNewSite(v.newSite);
      setVendor(v.vendor);
      setDescription(v.description);
      setAmount(v.amount);
      setMethod(v.method);
      setInvoiceRef(v.invoiceRef);
    },
  });

  const isNewCategory = category === NEW_CATEGORY;
  const finalCategory = isNewCategory ? newCategory.trim().toLowerCase() : category;
  const isNewSite = site === NEW_SITE;
  const finalSite = isNewSite ? newSite.trim().toLowerCase() : site;

  const save = async () => {
    if (!vendor.trim() || !amount || !finalCategory || !finalSite) return;
    setSaving(true);
    try {
      let attachmentUrl: string | undefined;
      if (file) attachmentUrl = await uploadHardCopy(file, "expense");
      // The system reference (AJD-EXP-date-number) is assigned automatically.
      create.mutate(
        {
          date,
          category: finalCategory,
          site: finalSite,
          vendor,
          description,
          amountTZS: amount,
          method,
          invoiceRef: invoiceRef || undefined,
          attachmentUrl,
        },
        {
          onSuccess: () => {
            toast.success(t("Matumizi yamerekodiwa", "Expense recorded"));
            draft.clear();
            setOpen(false);
            setVendor("");
            setDescription("");
            setAmount(0);
            setInvoiceRef("");
            setFile(null);
            setNewCategory("");
            setNewSite("");
          },
          onError: () => toast.error(t("Imeshindikana kurekodi", "Could not record expense")),
          onSettled: () => setSaving(false),
        },
      );
    } catch {
      toast.error(t("Imeshindikana kupakia nakala", "Could not upload the hard copy"));
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Matumizi mapya", "New expense")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekodi matumizi", "Record an expense")}</SheetTitle>
        </SheetHeader>
        <DraftNotice
          show={draft.restored}
          onDiscard={() => {
            draft.clear();
            setVendor("");
            setDescription("");
            setAmount(0);
            setInvoiceRef("");
          }}
        />
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kategoria", "Category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((k) => (
                    <SelectItem key={k} value={k}>
                      {categoryLabel(k, lang)}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>
                    + {t("Kategoria mpya", "New category")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isNewCategory && (
            <div className="grid gap-1.5">
              <Label>{t("Jina la kategoria mpya", "New category name")}</Label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t("mf. Bima ya gari", "e.g. Vehicle insurance")}
              />
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Itakumbukwa na kupatikana wakati mwingine.",
                  "It'll be remembered and available next time.",
                )}
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{t("Mahali", "Place")}</Label>
            <Select value={site} onValueChange={setSite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sites.map((k) => (
                  <SelectItem key={k} value={k}>
                    {siteLabel(k, lang)}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SITE}>+ {t("Mahali papya", "New place")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-[11px] text-muted-foreground">
              {t(
                "Matumizi haya ni ya sehemu gani ya biashara.",
                "Which part of the business this spend belongs to.",
              )}
            </div>
          </div>
          {isNewSite && (
            <div className="grid gap-1.5">
              <Label>{t("Jina la mahali papya", "New place name")}</Label>
              <Input
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                placeholder={t("mf. Duka la Njiro", "e.g. Njiro shop")}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{t("Muuzaji", "Vendor")}</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Total Sakina"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo", "Description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("Mfano, dizeli ya gari #1", "e.g. diesel for van #1")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Njia", "Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Rejea ya ankara (hiari)", "Invoice ref (optional)")}</Label>
              <Input
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="INV-2034"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>
              {t("Nakala ya ankara (hiari, picha au PDF)", "Invoice copy (optional, photo or PDF)")}
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {file && <div className="text-[11px] text-muted-foreground">{file.name}</div>}
          </div>
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Rejea ya mfumo (AJD-EXP-tarehe-namba) itatengenezwa otomatiki na inaonekana kwenye orodha.",
              "A system reference (AJD-EXP-date-number) is assigned automatically and shown in the list.",
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={
              saving ||
              create.isPending ||
              (isNewCategory && !newCategory.trim()) ||
              (isNewSite && !newSite.trim())
            }
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {saving || create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
