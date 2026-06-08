import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceScreen } from "@/screens/UtilityScreens";
export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance, African Joy Dairy" }] }),
  component: MaintenanceScreen,
});
