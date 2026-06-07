import { createFileRoute } from "@tanstack/react-router";
import { ReconciliationScreen } from "@/screens/ReconciliationScreen";
export const Route = createFileRoute("/reconciliation")({ component: ReconciliationScreen });
