import { createFileRoute } from "@tanstack/react-router";
import { lazyScreen } from "@/components/shell/lazyScreen";

const DashboardScreen = lazyScreen(
  () => import("@/screens/DashboardScreen"),
  "DashboardScreen",
);

export const Route = createFileRoute("/dashboard")({ component: DashboardScreen });
