import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { EXPENSES, TODAY, type Expense, type ExpenseCategory } from "@/mock/data";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";

const CATEGORY_META: Record<
  ExpenseCategory,
  { icon: typeof Fuel; sw: string; en: string; color: string }
> = {
  fuel: { icon: Fuel, sw: "Mafuta", en: "Fuel", color: "#1E7C3F" },
  packaging: { icon: Box, sw: "Vifungashio", en: "Packaging", color: "#2F9E44" },
  repairs: { icon: Wrench, sw: "Marekebisho", en: "Repairs", color: "#E5A100" },
  wages: { icon: Users, sw: "Mishahara", en: "Wages", color: "#6FBF59" },
  utilities: { icon: Zap, sw: "Huduma", en: "Utilities", color: "#8CC63F" },
  transport: { icon: Truck, sw: "Usafiri", en: "Transport", color: "#1D9E75" },
  office: { icon: Briefcase, sw: "Ofisi", en: "Office", color: "#14532D" },
  other: { icon: HelpCircle, sw: "Nyingine", en: "Other", color: "#6B776E" },
};

export function ExpensesScreen() {
  const { t, lang, can } = useApp();
  const loading = useSimulatedLoad(350);
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        if (cat !== "all" && e.category !== cat) return false;
        if (q) {
          const needle = q.toLowerCase();
          const text = `${e.vendor} ${e.description} ${e.ref ?? ""}`.toLowerCase();
          if (!text.includes(needle)) return false;
        }
        return true;
      }),
    [expenses, q, cat],
  );

  const total = expenses.reduce((a, e) => a + e.amountTZS, 0);
  const today = expenses.filter((e) => e.date === TODAY).reduce((a, e) => a + e.amountTZS, 0);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) map[e.category] = (map[e.category] ?? 0) + e.amountTZS;
    return Object.entries(map).map(([category, value]) => ({
      category,
      value,
      label:
        lang === "sw"
          ? CATEGORY_META[category as ExpenseCategory].sw
          : CATEGORY_META[category as ExpenseCategory].en,
      color: CATEGORY_META[category as ExpenseCategory].color,
    }));
  }, [expenses, lang]);

  if (loading) {
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
          sub={`${expenses.filter((e) => e.date === TODAY).length} ${t("rekodi", "entries")}`}
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
                    {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {lang === "sw" ? CATEGORY_META[k].sw : CATEGORY_META[k].en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ExportMenu formats={["csv", "excel"]} filename="expenses" />
                {can("finance:write") && (
                  <AddExpenseDialog onAdd={(e) => setExpenses((xs) => [e, ...xs])} />
                )}
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
                    <th>{t("Muuzaji", "Vendor")}</th>
                    <th>{t("Maelezo", "Description")}</th>
                    <th>{t("Njia", "Method")}</th>
                    <th className="text-right">{t("Kiasi", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const meta = CATEGORY_META[e.category];
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
                            {lang === "sw" ? meta.sw : meta.en}
                          </Pill>
                        </td>
                        <td className="py-2.5 font-medium">{e.vendor}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {e.description}
                          {e.ref && <div className="font-num text-[10px]">{e.ref}</div>}
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
                    <td colSpan={5} className="py-3 px-3 font-semibold">
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

function AddExpenseDialog({ onAdd }: { onAdd: (e: Expense) => void }) {
  const { t, lang, user } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(TODAY);
  const [category, setCategory] = useState<ExpenseCategory>("fuel");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("cash");
  const [ref, setRef] = useState("");

  const save = () => {
    if (!vendor.trim() || !amount) return;
    onAdd({
      id: `ex-${Date.now()}`,
      date,
      category,
      vendor,
      description,
      amountTZS: amount,
      method,
      ref: ref || undefined,
      recordedBy: user?.name ?? "Unknown",
    });
    toast.success(t("Matumizi yamerekodiwa", "Expense recorded"));
    setOpen(false);
    setVendor("");
    setDescription("");
    setAmount(0);
    setRef("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Matumizi mapya", "New expense")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rekodi matumizi", "Record an expense")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kategoria", "Category")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {lang === "sw" ? CATEGORY_META[k].sw : CATEGORY_META[k].en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
              <Label>{t("Rejea", "Ref")}</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="INV-…" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
