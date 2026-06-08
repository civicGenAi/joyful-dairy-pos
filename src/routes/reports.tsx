import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ReportsScreen = lazyScreen(() => import("@/screens/ReportsScreen"), "ReportsScreen");

export const Route = createFileRoute("/reports")({
  component: () => (
    <RequireCap cap="view:reports">
      <ReportsScreen />
    </RequireCap>
  ),
});
