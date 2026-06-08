import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ReconciliationScreen = lazyScreen(
  () => import("@/screens/ReconciliationScreen"),
  "ReconciliationScreen",
);

export const Route = createFileRoute("/reconciliation")({
  component: () => (
    <RequireCap cap="reconciliation:read">
      <ReconciliationScreen />
    </RequireCap>
  ),
});
