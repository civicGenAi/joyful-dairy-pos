import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const StockScreen = lazyScreen(() => import("@/screens/StockScreen"), "StockScreen");

export const Route = createFileRoute("/stock")({
  component: () => (
    <RequireCap cap="stock:read">
      <StockScreen />
    </RequireCap>
  ),
});
