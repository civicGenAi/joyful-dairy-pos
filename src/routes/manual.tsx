import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ManualScreen = lazyScreen(() => import("@/screens/ManualScreen"), "ManualScreen");

export const Route = createFileRoute("/manual")({
  component: () => (
    <RequireCap cap="view:dashboard">
      <ManualScreen />
    </RequireCap>
  ),
});
