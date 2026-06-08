import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const FinanceScreen = lazyScreen(() => import("@/screens/FinanceScreen"), "FinanceScreen");

export const Route = createFileRoute("/finance")({
  component: () => (
    <RequireCap cap="finance:read">
      <FinanceScreen />
    </RequireCap>
  ),
});
