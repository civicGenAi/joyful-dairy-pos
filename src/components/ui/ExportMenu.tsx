import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/app/context";
// BACKEND: real file exports (CSV / Excel / branded PDF), no demo blobs.
import { exportCSV, exportExcel, exportPDF, type ExportData } from "@/lib/export";

export type ExportFormat = "pdf" | "excel" | "csv";

const ICONS: Record<ExportFormat, typeof Download> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: FileType2,
};

const LABELS: Record<ExportFormat, { sw: string; en: string }> = {
  pdf: { sw: "PDF", en: "PDF" },
  excel: { sw: "Excel", en: "Excel" },
  csv: { sw: "CSV", en: "CSV" },
};

export function ExportMenu({
  formats,
  filename = "export",
  data,
}: {
  formats: ExportFormat[];
  filename?: string;
  /** The rows to export; a function defers building until the click. */
  data?: ExportData | (() => ExportData);
}) {
  const { t } = useApp();
  const doExport = (f: ExportFormat) => {
    const resolved = typeof data === "function" ? data() : data;
    if (!resolved || resolved.rows.length === 0) {
      toast.error(t("Hakuna data ya kuhamisha", "No data to export"));
      return;
    }
    try {
      if (f === "csv") exportCSV(resolved, filename);
      else if (f === "excel") exportExcel(resolved, filename);
      else exportPDF(resolved, filename);
      toast.success(t(`Imehamishwa kama ${f.toUpperCase()}`, `Exported as ${f.toUpperCase()}`));
    } catch {
      toast.error(t("Imeshindikana kuhamisha", "Export failed"));
    }
  };

  if (formats.length === 1) {
    const f = formats[0];
    const Icon = ICONS[f];
    return (
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => doExport(f)}>
        <Icon className="h-3.5 w-3.5 mr-1.5" /> {t("Hamisha", "Export")} {LABELS[f].en}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" /> {t("Hamisha", "Export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((f) => {
          const Icon = ICONS[f];
          return (
            <DropdownMenuItem key={f} onClick={() => doExport(f)}>
              <Icon className="h-4 w-4 mr-2" /> {LABELS[f].en}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
