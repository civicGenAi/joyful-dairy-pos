import { createFileRoute } from "@tanstack/react-router";
import { ProductionScreen } from "@/screens/ProductionScreen";
export const Route = createFileRoute("/production")({ component: ProductionScreen });
