import { createFileRoute } from "@tanstack/react-router";
import { StockScreen } from "@/screens/StockScreen";
export const Route = createFileRoute("/stock")({ component: StockScreen });
