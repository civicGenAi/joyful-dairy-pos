import { createFileRoute } from "@tanstack/react-router";
import { CustomersScreen } from "@/screens/CustomersScreen";
export const Route = createFileRoute("/customers")({ component: CustomersScreen });
