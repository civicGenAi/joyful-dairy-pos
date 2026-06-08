import { createFileRoute } from "@tanstack/react-router";
import { OfflineScreen } from "@/screens/UtilityScreens";
export const Route = createFileRoute("/offline")({
  head: () => ({ meta: [{ title: "Offline, African Joy Dairy" }] }),
  component: OfflineScreen,
});
