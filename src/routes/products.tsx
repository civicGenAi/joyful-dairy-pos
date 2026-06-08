import { createFileRoute } from "@tanstack/react-router";
import { ProductsScreen } from "@/screens/ProductsScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/products")({
  component: () => <RequireCap cap="products:read"><ProductsScreen /></RequireCap>,
});
