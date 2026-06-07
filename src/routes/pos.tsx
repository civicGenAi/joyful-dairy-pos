import { createFileRoute } from "@tanstack/react-router";
import { POSScreen } from "@/screens/POSScreen";
export const Route = createFileRoute("/pos")({ component: POSScreen });
