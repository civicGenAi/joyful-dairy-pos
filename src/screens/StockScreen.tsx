import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { STOCK } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { num } from "@/lib/format";
import { AlertTriangle, PackagePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function statusOf(s: typeof STOCK[number]) {
  if (s.onHand <= 0) return "danger" as const;
  if (s.onHand < s.reorder) return "warning" as const;
  return "success" as const;
}

export function StockScreen() {
  const { t } = useApp();
  const lowCount = STOCK.filter((s) => s.onHand < s.reorder && s.onHand > 0).length;
  const outCount = STOCK.filter((s) => s.onHand <= 0).length;

  return (
    <AppShell title={t("Ghala na Stock", "Stock & store")}>
      {(lowCount + outCount > 0) && (
        <div className="mb-5 rounded-2xl border border-[#E11B22]/30 bg-[#E11B22]/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[#E11B22]" />
          <div className="flex-1">
            <div className="font-semibold">{outCount} {t("nje ya stock", "out of stock")} · {lowCount} {t("chini ya kiwango", "low")}</div>
            <div className="text-xs text-muted-foreground">{t("Tafadhali wasiliana na ghala kwa kuagiza tena", "Please coordinate restocking with the store keeper")}</div>
          </div>
          <Button variant="outline" className="border-[#E11B22] text-[#E11B22] hover:bg-[#E11B22]/10">{t("Tazama orodha", "View list")}</Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("SKUs zote", "Total SKUs")} value={STOCK.length} accent="green" />
        <StatCard label={t("Bidhaa za kumaliza", "Finished SKUs")} value={STOCK.filter((s) => s.category === "finished").length} accent="info" />
        <StatCard label={t("Vifaa ghala", "Consumables")} value={STOCK.filter((s) => s.category === "consumable").length} accent="amber" />
        <StatCard label={t("Arifa za stock", "Low alerts")} value={lowCount + outCount} accent="red" />
      </div>

      <Tabs defaultValue="finished">
        <TabsList>
          <TabsTrigger value="finished">{t("Bidhaa kumaliza", "Finished products")}</TabsTrigger>
          <TabsTrigger value="consumables">{t("Vifaa ghala", "Consumables store")}</TabsTrigger>
          <TabsTrigger value="movements">{t("Harakati", "Stock movements")}</TabsTrigger>
        </TabsList>

        {(["finished", "consumables"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <SectionCard
              title={tab === "finished" ? t("Bidhaa za kumaliza", "Finished products") : t("Vifaa vya ghala", "Consumables (Ghala)")}
              action={<div className="flex gap-2"><ExportMenu formats={["csv", "excel"]} filename={`stock-${tab}`} /><ReceiveDialog /></div>}
            >
              <table className="w-full text-sm table-zebra">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Bidhaa", "Item")}</th>
                  <th className="text-right px-3">{t("Inayopatikana", "On hand")}</th>
                  <th className="text-right px-3">{t("Kiwango cha chini", "Reorder")}</th>
                  <th className="px-3">{t("Hali", "Status")}</th>
                  <th className="px-3">{t("Harakati", "Last move")}</th>
                </tr></thead>
                <tbody>
                  {STOCK.filter((s) => s.category === (tab === "finished" ? "finished" : "consumable")).map((s) => {
                    const tone = statusOf(s);
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">{s.name}{s.swName && <span className="text-xs text-muted-foreground ml-1">/ {s.swName}</span>}</td>
                        <td className="py-2.5 px-3 text-right font-num font-semibold">{num(s.onHand)} {s.unit}</td>
                        <td className="py-2.5 px-3 text-right font-num text-muted-foreground">{num(s.reorder)} {s.unit}</td>
                        <td className="py-2.5 px-3"><Pill tone={tone}>{tone === "danger" ? t("Imeisha", "Out") : tone === "warning" ? t("Chini", "Low") : "OK"}</Pill></td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{s.lastMovement}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SectionCard>
          </TabsContent>
        ))}

        <TabsContent value="movements" className="mt-4">
          <SectionCard title={t("Daftari la harakati za stock", "Stock movements log")}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Wakati", "Time")}</th><th>{t("Bidhaa", "Item")}</th><th>{t("Aina", "Type")}</th><th className="text-right">{t("Mabadiliko", "Δ")}</th><th>{t("Aliyefanya", "By")}</th>
              </tr></thead>
              <tbody>
                {[
                  { t: "08:12", i: "Fresh milk", k: "Receive", d: "+220 L", b: "Joyce" },
                  { t: "09:30", i: "Mozzarella", k: "Issue", d: "-3 kg", b: "Neema" },
                  { t: "10:05", i: "Vikopo robo", k: "Issue", d: "-60 pcs", b: "Mama Esther" },
                  { t: "10:42", i: "Butter 250g", k: "Sale", d: "-12 pcs", b: "POS" },
                  { t: "12:18", i: "Halloumi", k: "Receive", d: "+6.35 kg", b: "Production" },
                  { t: "13:50", i: "Madumu 5L", k: "Issue", d: "-4 pcs", b: "Route" },
                ].map((m, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{m.t}</td>
                    <td className="py-2.5 font-medium">{m.i}</td>
                    <td className="py-2.5"><Pill tone={m.k === "Issue" || m.k === "Sale" ? "warning" : "success"}>{m.k}</Pill></td>
                    <td className="py-2.5 text-right font-num font-semibold">{m.d}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ReceiveDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><PackagePlus className="h-3.5 w-3.5 mr-1.5" />{t("Pokea ununuzi", "Receive purchase")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Pokea bidhaa ghalani", "Receive items to store")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Bidhaa", "Item")}</Label>
            <Select defaultValue={STOCK[10].id}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STOCK.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Idadi", "Qty")}</Label><Input type="number" defaultValue={50} /></div>
            <div className="grid gap-1.5"><Label>{t("Gharama (TZS)", "Cost (TZS)")}</Label><Input type="number" defaultValue={25000} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button><Button onClick={() => { toast.success(t("Imepokelewa", "Received")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
