import { createFileRoute } from "@tanstack/react-router";
import { StockScreen } from "@/screens/StockScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/stock")({
  component: () => (
    <RequireCap cap="stock:read">
      <StockScreen />
    </RequireCap>
  ),
});
