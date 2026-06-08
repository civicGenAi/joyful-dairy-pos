import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div
        className="grid h-14 w-14 place-items-center rounded-2xl text-white mb-4 shadow-card"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="font-display text-base font-semibold">{title}</div>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
