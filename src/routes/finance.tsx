import { createFileRoute } from "@tanstack/react-router";
import { FinanceScreen } from "@/screens/FinanceScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/finance")({
  component: () => <RequireCap cap="finance:read"><FinanceScreen /></RequireCap>,
});
