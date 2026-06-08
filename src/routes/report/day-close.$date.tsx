import { createFileRoute } from "@tanstack/react-router";
import { DayCloseReportScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/report/day-close/$date")({
  head: () => ({ meta: [{ title: "Day-close report, African Joy Dairy" }] }),
  component: () => (
    <RequireCap cap="reconciliation:read">
      <DayCloseReportScreen />
    </RequireCap>
  ),
});
