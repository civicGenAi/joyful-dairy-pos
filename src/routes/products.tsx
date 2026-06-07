import { createFileRoute } from "@tanstack/react-router";
import { ProductsScreen } from "@/screens/ProductsScreen";
export const Route = createFileRoute("/products")({ component: ProductsScreen });
