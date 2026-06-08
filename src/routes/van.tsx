import { createFileRoute } from "@tanstack/react-router";
import { RouteScreen } from "@/screens/RouteScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/van")({
  component: () => <RequireCap cap="route:use"><RouteScreen /></RequireCap>,
});
