import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const PayrollScreen = lazyScreen(() => import("@/screens/PayrollScreen"), "PayrollScreen");

export const Route = createFileRoute("/payroll")({
  component: () => (
    <RequireCap cap="finance:read">
      <PayrollScreen />
    </RequireCap>
  ),
});
