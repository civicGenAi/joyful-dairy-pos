import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const FarmersScreen = lazyScreen(() => import("@/screens/FarmersScreen"), "FarmersScreen");

export const Route = createFileRoute("/farmers")({
  component: () => (
    <RequireCap cap="farmers:read">
      <FarmersScreen />
    </RequireCap>
  ),
});
