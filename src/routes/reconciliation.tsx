import { createFileRoute } from "@tanstack/react-router";
import { ReconciliationScreen } from "@/screens/ReconciliationScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/reconciliation")({
  component: () => (
    <RequireCap cap="reconciliation:read">
      <ReconciliationScreen />
    </RequireCap>
  ),
});
