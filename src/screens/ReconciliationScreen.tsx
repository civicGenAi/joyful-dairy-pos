import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { RECON_TODAY } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { num } from "@/lib/format";
import { Check, X, Lock, Sigma } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function isBalanced(r: typeof RECON_TODAY[number]) {
  const lhs = r.opening + r.collected + r.produced;
  const rhs = r.soldCash + r.soldCredit + r.separated + r.spoilt + r.returned + r.closing;
  return Math.abs(lhs - rhs) < 0.05;
}

export function ReconciliationScreen() {
  const { t, role } = useApp();
  const [locked, setLocked] = useState(false);
  const allBalanced = RECON_TODAY.every(isBalanced);
  const canLock = role === "admin" || role === "production";

  return (
    <AppShell title={t("Sawazisha siku · Funga siku", "Day reconciliation & day-close")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Bidhaa", "Products")} value={RECON_TODAY.length} accent="green" />
        <StatCard label={t("Zilizosawazi", "Balanced")} value={`${RECON_TODAY.filter(isBalanced).length}/${RECON_TODAY.length}`} accent={allBalanced ? "green" : "amber"} />
        <StatCard label={t("Hali ya siku", "Day status")} value={locked ? t("Imefungwa", "Locked") : t("Imefunguliwa", "Open")} accent={locked ? "green" : "amber"} />
        <StatCard label={t("Wakati", "Time")} value={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} accent="info" />
      </div>

      <div className="rounded-2xl border border-[#1E7C3F]/30 bg-[#1E7C3F]/5 p-4 mb-5 flex items-center gap-3">
        <Sigma className="h-5 w-5 text-[#1E7C3F]" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{t("Kanuni ya usawazishaji", "Conservation rule")}</div>
          <div className="text-xs font-num text-[#14532D]">Opening + Collected + Produced = Sold cash + Sold credit + Separated + Spoilt + Returned + Closing</div>
        </div>
        <Pill tone={allBalanced ? "success" : "danger"}>{allBalanced ? t("Sawa", "OK") : t("Hata", "Mismatch")}</Pill>
      </div>

      {locked && (
        <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/10 p-4 mb-5 flex items-center gap-3">
          <Lock className="h-5 w-5 text-[#0f5d44]" />
          <div className="flex-1">
            <div className="font-semibold text-sm">{t("Siku imefungwa", "Day locked")}</div>
            <div className="text-xs text-muted-foreground">{t("Imefungwa na", "Locked by")} Daudi Massawe · {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      <SectionCard title={t("Sawazisho la kila bidhaa", "Per-product reconciliation")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
              <th className="text-right px-2">{t("Awali", "Opening")}</th>
              <th className="text-right px-2">{t("Kusanywa", "Collected")}</th>
              <th className="text-right px-2">{t("Tengeneza", "Produced")}</th>
              <th className="text-right px-2">{t("Cash", "Cash")}</th>
              <th className="text-right px-2">{t("Mkopo", "Credit")}</th>
              <th className="text-right px-2">{t("Tenga", "Separated")}</th>
              <th className="text-right px-2">{t("Haribika", "Spoilt")}</th>
              <th className="text-right px-2">{t("Rudi", "Returned")}</th>
              <th className="text-right px-2">{t("Bakia", "Closing")}</th>
              <th className="text-center px-2">{t("Sawazi", "Balanced")}</th>
            </tr></thead>
            <tbody>
              {RECON_TODAY.map((r, i) => {
                const ok = isBalanced(r);
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="py-2.5 px-3 font-medium">{r.product}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.opening, r.opening % 1 ? 2 : 0)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.collected)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.produced, r.produced % 1 ? 2 : 0)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.soldCash)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.soldCredit)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.separated)}</td>
                    <td className="py-2.5 px-2 text-right font-num text-[#E11B22]">{num(r.spoilt)}</td>
                    <td className="py-2.5 px-2 text-right font-num">{num(r.returned)}</td>
                    <td className="py-2.5 px-2 text-right font-num font-bold">{num(r.closing, r.closing % 1 ? 2 : 0)}</td>
                    <td className="py-2.5 px-2 text-center">
                      {ok ? <Check className="inline h-4 w-4 text-[#2F9E44]" /> : <X className="inline h-4 w-4 text-[#E11B22]" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <SectionCard title={t("Vyanzo vya maziwa ghafi", "Raw milk sources today")}>
          <ul className="divide-y divide-border">
            {[{ src: "Baraka (transport)", l: 220 }, { src: "Wafugaji (farmers)", l: 580 }, { src: "Baridi (cold-room)", l: 60 }].map((s) => (
              <li key={s.src} className="flex justify-between py-2.5"><span className="font-medium">{s.src}</span><span className="font-num font-semibold">{num(s.l)} L</span></li>
            ))}
            <li className="flex justify-between py-3 font-bold border-t-2 border-[#1E7C3F]/40"><span>{t("Jumla", "Total")}</span><span className="font-num text-[#1E7C3F]">860 L</span></li>
          </ul>
        </SectionCard>

        <SectionCard title={t("Funga siku", "Day close")}>
          <p className="text-sm text-muted-foreground mb-4">{t("Baada ya kufunga, salio la mwisho linakuwa salio la awali la kesho. Inahitajika jukumu la Production au Admin.", "After locking, closing balances become tomorrow's opening. Requires Production Manager or Admin role.")}</p>
          <div className="flex gap-2">
            <Button disabled={!canLock || locked} onClick={() => { setLocked(true); toast.success(t("Siku imefungwa", "Day locked")); }} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><Lock className="h-4 w-4 mr-1.5" />{locked ? t("Imefungwa", "Locked") : t("Funga siku", "Lock day")}</Button>
            {!canLock && <Pill tone="warning">{t("Huna ruhusa", "No permission")}</Pill>}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
