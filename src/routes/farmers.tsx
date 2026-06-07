import { createFileRoute } from "@tanstack/react-router";
import { FarmersScreen } from "@/screens/FarmersScreen";
export const Route = createFileRoute("/farmers")({ component: FarmersScreen });
