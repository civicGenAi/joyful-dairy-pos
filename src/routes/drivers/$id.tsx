import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const DriverDetailScreen = lazyScreen(
  () => import("@/screens/DriverDetailScreen"),
  "DriverDetailScreen",
);

export const Route = createFileRoute("/drivers/$id")({
  component: () => (
    <RequireCap cap="users:read">
      <DriverDetailScreen />
    </RequireCap>
  ),
});
