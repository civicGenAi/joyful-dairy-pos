import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const ProductsScreen = lazyScreen(() => import("@/screens/ProductsScreen"), "ProductsScreen");

export const Route = createFileRoute("/products")({
  component: () => (
    <RequireCap cap="products:read">
      <ProductsScreen />
    </RequireCap>
  ),
});
