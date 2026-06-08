import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ProductionScreen = lazyScreen(
  () => import("@/screens/ProductionScreen"),
  "ProductionScreen",
);

export const Route = createFileRoute("/production")({
  component: () => (
    <RequireCap cap="production:read">
      <ProductionScreen />
    </RequireCap>
  ),
});
