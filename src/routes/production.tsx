import { createFileRoute } from "@tanstack/react-router";
import { ProductionScreen } from "@/screens/ProductionScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/production")({
  component: () => (
    <RequireCap cap="production:read">
      <ProductionScreen />
    </RequireCap>
  ),
});
