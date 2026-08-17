import { useApp } from "@/app/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pill } from "@/components/ui/data-bits";
import { useLocations } from "@/lib/data/hooks/locations";
import { useRecordCollectionDay } from "@/lib/data/hooks/collections";
import { L } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import type { Farmer } from "@/mock/types";

// Bulk collection entry from a spreadsheet, since most of the day's data
// already lives in Excel before it ever reaches this system. Expected
// columns (header row, case-insensitive): Farmer, Date, Morning, Evening,
// Point (optional), Notes (optional). Every row goes through the same
// record_collection_day() RPC a manual entry would, so a bad import can
// never write something the app itself wouldn't allow (a locked day, an
// unknown farmer, a negative amount).

interface ParsedRow {
  rowNum: number;
  farmerName: string;
  farmerId: string | null;
  date: string | null;
  morning: number;
  evening: number;
  point: string;
  note: string;
  error: string | null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Accepts "2026-05-12", "12/05/2026", or an Excel date serial already
 *  converted to a JS Date by the reader, returns a plain ISO date string. */
function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const s = value.trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  return 0;
}

export function ImportCollectionsDialog({ farmers }: { farmers: Farmer[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);
  const { data: locations = [] } = useLocations();
  const points = locations.filter(
    (l) => l.active && (l.kind === "collection-point" || l.kind === "plant"),
  );
  const recordDay = useRecordCollectionDay();

  const farmerByName = new Map(farmers.map((f) => [normalize(f.name), f]));

  const parseFile = async (file: File) => {
    setResults(null);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const parsed: ParsedRow[] = raw.map((r, i) => {
      const get = (...keys: string[]) => {
        for (const k of Object.keys(r)) {
          if (keys.includes(normalize(k))) return r[k];
        }
        return "";
      };
      const farmerName = String(get("farmer", "mfugaji", "name") ?? "").trim();
      const farmer = farmerByName.get(normalize(farmerName));
      const date = toIsoDate(get("date", "tarehe"));
      const morning = toNumber(get("morning", "asubuhi"));
      const evening = toNumber(get("evening", "jioni"));
      const pointName = String(get("point", "pointi") ?? "").trim();
      const point = pointName
        ? (points.find((p) => normalize(p.name) === normalize(pointName)) ??
          points.find((p) => normalize(p.swName) === normalize(pointName)))
        : points[0];
      const note = String(get("notes", "note", "maelezo") ?? "").trim();

      let error: string | null = null;
      if (!farmerName) error = t("Jina la mfugaji halipo", "Missing farmer name");
      else if (!farmer) error = t("Mfugaji hajulikani", "Farmer not recognized");
      else if (!date) error = t("Tarehe si sahihi", "Invalid date");
      else if (Number.isNaN(morning) || Number.isNaN(evening))
        error = t("Idadi ya litre si sahihi", "Invalid litres value");
      else if (morning <= 0 && evening <= 0)
        error = t("Hakuna litre zilizowekwa", "No litres given");
      else if (!point) error = t("Pointi hailingani", "Point not recognized");

      return {
        rowNum: i + 2, // header row is 1
        farmerName,
        farmerId: farmer?.id ?? null,
        date,
        morning: Number.isFinite(morning) ? Math.max(0, morning) : 0,
        evening: Number.isFinite(evening) ? Math.max(0, evening) : 0,
        point: point?.id ?? "",
        note,
        error,
      };
    });
    setRows(parsed);
  };

  const validRows = rows.filter((r) => !r.error);

  const runImport = async () => {
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const r of validRows) {
      try {
        await recordDay.mutateAsync({
          farmerId: r.farmerId!,
          date: r.date!,
          locationId: r.point,
          morningLitres: r.morning,
          eveningLitres: r.evening,
          qualityNote: r.note || undefined,
        });
        ok += 1;
      } catch (e) {
        failed += 1;
        setRows((prev) =>
          prev.map((row) =>
            row.rowNum === r.rowNum ? { ...row, error: (e as Error).message } : row,
          ),
        );
      }
    }
    setImporting(false);
    setResults({ ok, failed });
    if (ok > 0) toast.success(t(`Safu ${ok} zimeingizwa`, `${ok} row(s) imported`));
    if (failed > 0) toast.error(t(`Safu ${failed} zimeshindikana`, `${failed} row(s) failed`));
  };

  const reset = () => {
    setRows([]);
    setResults(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-8">
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          {t("Leta kutoka Excel", "Import from Excel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("Leta ukusanyaji kutoka Excel", "Import collections from Excel")}
          </DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
              {t(
                "Safu wima: Farmer, Date, Morning, Evening, Point (hiari), Notes (hiari). Mstari wa kwanza ni vichwa vya habari.",
                "Columns: Farmer, Date, Morning, Evening, Point (optional), Notes (optional). First row is the header.",
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>
                {t("Chagua faili (.xlsx, .xls, .csv)", "Choose file (.xlsx, .xls, .csv)")}
              </Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void parseFile(f);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <Pill tone="success">
                {validRows.length} {t("sahihi", "valid")}
              </Pill>
              {rows.length - validRows.length > 0 && (
                <Pill tone="danger">
                  {rows.length - validRows.length} {t("na hitilafu", "with errors")}
                </Pill>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-1.5 px-2">#</th>
                    <th className="py-1.5 px-2">{t("Mfugaji", "Farmer")}</th>
                    <th className="py-1.5 px-2">{t("Tarehe", "Date")}</th>
                    <th className="py-1.5 px-2 text-right">{t("Asubuhi", "AM")}</th>
                    <th className="py-1.5 px-2 text-right">{t("Jioni", "PM")}</th>
                    <th className="py-1.5 px-2">{t("Hali", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNum} className="border-b border-border last:border-0">
                      <td className="py-1.5 px-2 text-muted-foreground">{r.rowNum}</td>
                      <td className="py-1.5 px-2">{r.farmerName || "–"}</td>
                      <td className="py-1.5 px-2 font-num">{r.date ?? "–"}</td>
                      <td className="py-1.5 px-2 text-right font-num">{L(r.morning)}</td>
                      <td className="py-1.5 px-2 text-right font-num">{L(r.evening)}</td>
                      <td className="py-1.5 px-2">
                        {r.error ? (
                          <span className="inline-flex items-center gap-1 text-[#E11B22]">
                            <AlertTriangle className="h-3 w-3" /> {r.error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#1E7C3F]">
                            <CheckCircle2 className="h-3 w-3" /> {t("Sawa", "OK")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results && (
              <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                {t(
                  `Imeingiza ${results.ok}, imeshindikana ${results.failed}.`,
                  `Imported ${results.ok}, failed ${results.failed}.`,
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <Button variant="outline" onClick={reset} disabled={importing}>
              {t("Anza upya", "Start over")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Funga", "Close")}
          </Button>
          {rows.length > 0 && !results && (
            <Button onClick={() => void runImport()} disabled={importing || validRows.length === 0}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {importing
                ? t("Inaingiza…", "Importing…")
                : t(`Ingiza safu ${validRows.length}`, `Import ${validRows.length} row(s)`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
