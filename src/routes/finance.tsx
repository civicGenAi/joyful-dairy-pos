import { createFileRoute } from "@tanstack/react-router";
import { FinanceScreen } from "@/screens/FinanceScreen";
export const Route = createFileRoute("/finance")({ component: FinanceScreen });
