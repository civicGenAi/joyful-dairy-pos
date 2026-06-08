import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyStandalone } from "@/components/shell/lazyScreen";

const RouteScreen = lazyStandalone(() => import("@/screens/RouteScreen"), "RouteScreen");

export const Route = createFileRoute("/van")({
  component: () => (
    <RequireCap cap="route:use">
      <RouteScreen />
    </RequireCap>
  ),
});
