import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const POSScreen = lazyScreen(() => import("@/screens/POSScreen"), "POSScreen");

export const Route = createFileRoute("/pos")({
  component: () => (
    <RequireCap cap="pos:use">
      <POSScreen />
    </RequireCap>
  ),
});
