import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useApp } from "@/app/context";

interface Props {
  itemName: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RowActions({ itemName, onView, onEdit, onDelete }: Props) {
  const { t } = useApp();
  return (
    <div className="flex items-center justify-end gap-1">
      {onView && (
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onView} title={t("Tazama", "View")}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {onView && <DropdownMenuItem onClick={onView}><Eye className="h-3.5 w-3.5 mr-2" />{t("Tazama", "View")}</DropdownMenuItem>}
          {onEdit && <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" />{t("Hariri", "Edit")}</DropdownMenuItem>}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <ConfirmDialog
                destructive
                title={t("Futa rekodi?", "Delete record?")}
                description={t(`Una uhakika unataka kufuta "${itemName}"? Kitendo hiki hakiwezi kutenduliwa.`, `Are you sure you want to delete "${itemName}"? This action cannot be undone.`)}
                confirmLabel={t("Futa", "Delete")}
                onConfirm={onDelete}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-[#E11B22] focus:text-[#E11B22]">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />{t("Futa", "Delete")}
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
