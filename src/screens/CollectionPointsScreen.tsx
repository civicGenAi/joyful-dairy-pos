import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { COLLECTIONS_TODAY, FARMERS } from "@/mock/data";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { L, num } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, MapPin } from "lucide-react";

export function CollectionPointsScreen() {
  const { t } = useApp();
  const pointA = COLLECTIONS_TODAY.filter((c) => c.point === "field-a").reduce((a, c) => a + c.litres, 0);
  const main = COLLECTIONS_TODAY.filter((c) => c.point === "main").reduce((a, c) => a + c.litres, 0);

  return (
    <AppShell title={t("Pointi za ukusanyaji", "Collection points")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Point A, Shambani", "Point A, Field")} value={L(pointA)} sub={t("Wafugaji 8 leo", "8 farmers today")} accent="green" />
        <StatCard label={t("Main, Kiwandani", "Main, Plant")} value={L(main)} sub={t("Wafugaji 7 leo", "7 farmers today")} accent="info" />
        <StatCard label={t("Jumla leo", "Total today")} value={L(pointA + main)} accent="green" />
        <StatCard label={t("Wahamishaji", "Transfers")} value={num(3)} sub={t("Field A → Plant", "Field A → Plant")} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {[
          { id: "field-a", name: "Point A, Olasiti", swName: "Point A, Olasiti", intake: pointA },
          { id: "main", name: "Main plant, Arusha", swName: "Kiwandani, Arusha", intake: main },
        ].map((p) => (
          <div key={p.id} className="rounded-2xl overflow-hidden border border-border shadow-card bg-card">
            <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #2F9E44 70%, #8CC63F)" }}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90"><MapPin className="h-3.5 w-3.5" /> {t("Point ya ukusanyaji", "Collection point")}</div>
              <div className="font-display text-2xl font-bold mt-1">{p.name}</div>
              <div className="mt-3 font-num text-3xl font-bold">{L(p.intake)}</div>
              <div className="text-xs opacity-85">{t("Yamekusanywa leo", "Collected today")}</div>
            </div>
            <div className="p-4 flex gap-2">
              <TransferDialog from={p.name} />
              <Button variant="outline" className="rounded-xl">{t("Tazama matokeo", "View intake log")}</Button>
            </div>
          </div>
        ))}
      </div>

      <SectionCard title={t("Matokeo ya leo, daftari", "Today's intake log")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Saa", "Time")}</th>
                <th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th>
                <th className="py-2 px-3">{t("Pointi", "Point")}</th>
                <th className="py-2 px-3">{t("Kipindi", "Session")}</th>
                <th className="py-2 px-3 text-right">{t("Litre", "Litres")}</th>
              </tr>
            </thead>
            <tbody>
              {COLLECTIONS_TODAY.slice(0, 14).map((c, i) => {
                const f = FARMERS.find((x) => x.id === c.farmerId);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{c.session === "morning" ? `06:${30 + i % 30}` : `17:${10 + i % 30}`}</td>
                    <td className="py-2.5 px-3 font-medium">{f?.name}</td>
                    <td className="py-2.5 px-3"><Pill tone={c.point === "field-a" ? "info" : "success"}>{c.point === "field-a" ? "Point A" : "Main"}</Pill></td>
                    <td className="py-2.5 px-3 text-xs">{c.session === "morning" ? t("Asubuhi", "Morning") : t("Jioni", "Evening")}</td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold">{num(c.litres)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-5">
        <SectionCard title={t("Uhamishaji wa hivi karibuni", "Recent transfers")}>
          <ul className="divide-y divide-border text-sm">
            {[
              { from: "Point A, Olasiti", to: "Main plant", litres: 240, time: "08:42" },
              { from: "Main plant", to: "Route van #1", litres: 120, time: "09:10" },
              { from: "Point A, Olasiti", to: "Route van #2", litres: 80, time: "09:20" },
            ].map((tx, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{tx.from} → {tx.to}</div>
                  <div className="text-xs text-muted-foreground">{tx.time}</div>
                </div>
                <div className="font-num font-semibold">{L(tx.litres)}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function TransferDialog({ from }: { from: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-xl text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />{t("Hamisha maziwa", "Transfer milk")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Hamisha maziwa", "Transfer milk")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Kutoka", "From")}</Label><Input defaultValue={from} readOnly /></div>
          <div className="grid gap-1.5"><Label>{t("Kwenda", "To")}</Label>
            <Select defaultValue="main"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="main">Main plant</SelectItem>
              <SelectItem value="van1">Route van #1</SelectItem>
              <SelectItem value="van2">Route van #2</SelectItem>
            </SelectContent></Select>
          </div>
          <div className="grid gap-1.5"><Label>{t("Litre", "Litres")}</Label><Input type="number" defaultValue={120} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => { toast.success(t("Uhamishaji umehifadhiwa", "Transfer saved")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
