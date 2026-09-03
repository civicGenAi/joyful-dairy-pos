import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: sales deposits reuse the same deposits table/RPC as the generic
// Deposits & receipts log in Finance, scoped to sales_deposit_categories
// sources instead of the fixed customer/route/pos/other ones.
import {
  useDepositsByRange,
  useSalesDepositCategories,
  useCreateSalesDepositCategory,
  useRecordDeposit,
} from "@/lib/data/hooks/sales";
import { SOURCE_LABEL } from "@/lib/data/sales";
import { todayISO } from "@/lib/data/dates";
import { uploadHardCopy } from "@/lib/data/uploads";
import { Pill, SectionCard } from "@/components/ui/data-bits";
import { tzs } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Plus,
  Receipt,
  Smartphone,
  ArrowUpRight,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftNotice } from "@/components/ui/DraftNotice";

// Banking real sales revenue (by product, and by outlet like Shambani or
// Masoko) month by month. Amounts are typed in by hand: POS and route
// sales don't record which outlet a sale happened at yet, so they can't
// be split out from real data.
export function SalesDepositsScreen() {
  const { t, lang, can } = useApp();
  const canDeposit = can("deposit:write");
  const currentMonth = todayISO().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, viewMon] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(viewYear, viewMon, 0).getDate();
  const monthStart = `${viewMonth}-01`;
  const monthEnd = `${viewMonth}-${String(daysInMonth).padStart(2, "0")}`;
  const { data: categories = [] } = useSalesDepositCategories();
  const { data: monthDeposits = [], isPending } = useDepositsByRange(monthStart, monthEnd);

  const salesDeposits = monthDeposits
    .filter((d) => categories.includes(d.source))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const grandTotal = salesDeposits.reduce((a, d) => a + d.amountTZS, 0);
  const byCategory = categories.map((cat) => {
    const txns = salesDeposits.filter((d) => d.source === cat);
    return { category: cat, txns, total: txns.reduce((a, d) => a + d.amountTZS, 0) };
  });

  const monthLabel = new Date(`${monthStart}T00:00:00`).toLocaleDateString(
    lang === "sw" ? "sw-TZ" : "en-GB",
    { month: "long", year: "numeric" },
  );
  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMon - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const label = (c: string) => t(SOURCE_LABEL[c]?.sw ?? c, SOURCE_LABEL[c]?.en ?? c);

  return (
    <AppShell title={t("Amana za mauzo", "Sales deposits")}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold w-40 text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={viewMonth >= currentMonth}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            formats={["csv", "excel", "pdf"]}
            filename={`sales-deposits-${viewMonth}`}
            data={() => ({
              title: t(`Amana za mauzo, ${monthLabel}`, `Sales deposits, ${monthLabel}`),
              headers: ["Date", "Category", "Channel", "Amount TZS"],
              rows: salesDeposits.map((d) => [d.date, label(d.source), d.method, d.amountTZS]),
            })}
          />
          {canDeposit && <RecordSalesDepositDialog categories={categories} />}
        </div>
      </div>

      {isPending ? (
        <SectionSkeleton>
          <TableSkeleton rows={7} cols={4} />
        </SectionSkeleton>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {byCategory.map(({ category, total, txns }) => (
              <div key={category} className="rounded-xl border border-border p-3">
                <div className="text-xs font-semibold">{label(category)}</div>
                <div className="font-num font-bold text-lg mt-0.5">{tzs(total)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {txns.length} {t("miamala", "deposits")}
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl border-2 p-3.5 flex items-center justify-between bg-[#F4F6F2]"
            style={{ borderColor: "#1E6B3A" }}
          >
            <span className="text-sm font-semibold">{t("Jumla ya mwezi", "Total this month")}</span>
            <span className="font-num font-bold text-lg">{tzs(grandTotal)}</span>
          </div>

          <SectionCard title={t("Miamala ya mwezi", "This month's deposits")}>
            {salesDeposits.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t("Hakuna amana za mauzo bado", "No sales deposits this month")}
                description={t(
                  "Bonyeza Amana mpya kurekodi ya kwanza.",
                  "Use New deposit to record the first one.",
                )}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                    <th>{t("Aina", "Category")}</th>
                    <th>{t("Njia", "Channel")}</th>
                    <th className="text-right">{t("Kiasi", "Amount")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {salesDeposits.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                        {d.date}
                      </td>
                      <td className="py-2.5">
                        <Pill tone="info">{label(d.source)}</Pill>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {d.method === "mpesa" ? (
                            <Smartphone className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {d.method}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-num font-semibold">
                        {tzs(d.amountTZS)}
                      </td>
                      <td className="py-2.5 text-right pr-3">
                        {d.attachmentUrl && (
                          <a
                            href={d.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={t("Risiti", "Receipt")}
                            className="text-[#1E7C3F] hover:opacity-70"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}

const NEW_SALES_CATEGORY = "__new__";

function RecordSalesDepositDialog({ categories }: { categories: string[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const record = useRecordDeposit();
  const createCategory = useCreateSalesDepositCategory();

  const draft = useFormDraft({
    key: "sales-deposit",
    enabled: open,
    value: { category, newCategory, date, amount, method },
    onRestore: (v) => {
      setCategory(v.category);
      setNewCategory(v.newCategory);
      setDate(v.date);
      setAmount(v.amount);
      setMethod(v.method);
    },
  });

  const isNewCategory = category === NEW_SALES_CATEGORY;
  const finalCategory = isNewCategory ? newCategory.trim().toLowerCase() : category;

  const save = async () => {
    if (!finalCategory || amount <= 0) return;
    setSaving(true);
    try {
      const attachmentUrl = file ? await uploadHardCopy(file, "deposit") : undefined;
      if (isNewCategory) await createCategory.mutateAsync(finalCategory);
      record.mutate(
        { source: finalCategory, method, amountTZS: amount, date, attachmentUrl },
        {
          onSuccess: () => {
            toast.success(t("Amana imerekodiwa", "Deposit recorded"));
            draft.clear();
            setOpen(false);
            setAmount(0);
            setFile(null);
            setNewCategory("");
          },
          onError: () => toast.error(t("Imeshindikana kurekodi", "Could not record the deposit")),
          onSettled: () => setSaving(false),
        },
      );
    } catch {
      toast.error(t("Imeshindikana kupakia risiti", "Could not upload the receipt"));
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
          {t("Amana mpya", "New deposit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekodi amana ya mauzo", "Record a sales deposit")}</SheetTitle>
        </SheetHeader>
        <DraftNotice
          show={draft.restored}
          onDiscard={() => {
            draft.clear();
            setAmount(0);
            setNewCategory("");
          }}
        />
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Aina/Sehemu", "Category/outlet")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(SOURCE_LABEL[c]?.sw ?? c, SOURCE_LABEL[c]?.en ?? c)}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SALES_CATEGORY}>{t("Ongeza mpya…", "Add new…")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isNewCategory && (
            <div className="grid gap-1.5">
              <Label>{t("Jina la aina mpya", "New category name")}</Label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t("mfano: Njiro", "e.g. Njiro")}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Njia", "Channel")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Risiti (hiari, picha au PDF)", "Receipt (optional, photo or PDF)")}</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {file && <div className="text-[11px] text-muted-foreground">{file.name}</div>}
            <div className="text-[11px] text-muted-foreground">
              {t(
                "Rejea hutengenezwa na mfumo. Unaweza kuhifadhi sasa na kupakia risiti baadaye.",
                "The reference is generated by the system. You can save now and attach the receipt later.",
              )}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={saving || record.isPending || amount <= 0}>
            {saving || record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
