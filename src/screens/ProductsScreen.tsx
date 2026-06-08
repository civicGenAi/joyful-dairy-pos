import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { PRICE_MATRIX, PRODUCTS } from "@/mock/data";
import type { PriceTier } from "@/mock/types";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";

export function ProductsScreen() {
  const { t } = useApp();
  const [prices, setPrices] = useState(PRICE_MATRIX);

  const setPrice = (pid: string, tier: PriceTier, v: number) =>
    setPrices((p) => ({ ...p, [pid]: { ...p[pid], [tier]: v } }));

  return (
    <AppShell title={t("Bidhaa na Bei", "Products & pricing")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Bidhaa jumla", "Total products")} value={PRODUCTS.length} accent="green" />
        <StatCard label={t("Jibini (cheese SKUs)", "Cheese SKUs")} value={PRODUCTS.filter(p => p.category === "cheese").length} accent="info" />
        <StatCard label={t("Yoghurt SKUs", "Yoghurt SKUs")} value={PRODUCTS.filter(p => p.category === "yoghurt").length} accent="amber" />
        <StatCard label={t("Bei tatu kwa kila SKU", "Tiers per SKU")} value={3} accent="green" />
      </div>

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">{t("Katalogi", "Catalogue")}</TabsTrigger>
          <TabsTrigger value="prices">{t("Bei", "Price matrix")}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="mt-4">
          <SectionCard title={t("Bidhaa zote", "All products")} action={<ExportMenu formats={["excel", "csv"]} filename="products" />}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Jina", "Name")}</th><th>{t("Kiswahili", "Swahili")}</th><th>{t("Kategoria", "Category")}</th><th>{t("Kipimo", "Unit")}</th><th>{t("Note", "Conversion")}</th><th>{t("Hai", "Active")}</th>
              </tr></thead>
              <tbody>
                {PRODUCTS.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.swName}</td>
                    <td className="py-2.5"><Pill tone="info">{p.category}</Pill></td>
                    <td className="py-2.5 font-num">{p.unit}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{p.conversionNote ?? "·"}</td>
                    <td className="py-2.5"><Switch defaultChecked={p.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="prices" className="mt-4">
          <SectionCard
            title={t("Bei (TZS), inahaririwa", "Price matrix (TZS), editable")}
            action={<Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Bei zimehifadhiwa", "Prices saved"))}><Save className="h-3.5 w-3.5 mr-1.5" />{t("Hifadhi", "Save")}</Button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
                  <th className="text-right px-3">{t("Chombo cha mteja", "Own container")}</th>
                  <th className="text-right px-3">{t("Pamoja na chupa", "With bottle")}</th>
                  <th className="text-right px-3">{t("Jumla / dozeni", "Bulk / dozen")}</th>
                </tr></thead>
                <tbody>
                  {PRODUCTS.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-medium">{p.name} <span className="text-xs text-muted-foreground">/{p.unit}</span></td>
                      {(["own", "bottle", "bulk"] as PriceTier[]).map((tier) => (
                        <td key={tier} className="py-1.5 px-3 text-right">
                          <Input value={prices[p.id][tier]} onChange={(e) => setPrice(p.id, tier, Number(e.target.value))} className="h-8 w-28 ml-auto text-right font-num" type="number" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
