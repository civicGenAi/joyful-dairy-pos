import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const StockCountScreen = lazyScreen(() => import("@/screens/StockCountScreen"), "StockCountScreen");

export const Route = createFileRoute("/stock-count")({
  component: () => (
    <RequireCap cap="stock:read">
      <StockCountScreen />
    </RequireCap>
  ),
});
