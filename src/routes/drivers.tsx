import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const DriversScreen = lazyScreen(() => import("@/screens/DriversScreen"), "DriversScreen");

export const Route = createFileRoute("/drivers")({
  component: () => (
    <RequireCap cap="users:read">
      <DriversScreen />
    </RequireCap>
  ),
});
