import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ExpensesScreen = lazyScreen(() => import("@/screens/ExpensesScreen"), "ExpensesScreen");

export const Route = createFileRoute("/expenses")({
  component: () => (
    <RequireCap cap="finance:read">
      <ExpensesScreen />
    </RequireCap>
  ),
});
