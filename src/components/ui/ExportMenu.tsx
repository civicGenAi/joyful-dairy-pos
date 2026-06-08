import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/app/context";

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

export function ExportMenu({ formats, filename = "export" }: { formats: ExportFormat[]; filename?: string }) {
  const { t } = useApp();
  const doExport = (f: ExportFormat) => {
    const ext = f === "excel" ? "xlsx" : f;
    const blob = new Blob([`African Joy Dairy demo export\nFile: ${filename}.${ext}\nGenerated: ${new Date().toLocaleString()}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t(`Imehamishwa kama ${f.toUpperCase()} (demo)`, `Exported as ${f.toUpperCase()} (demo)`));
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
