import { createFileRoute } from "@tanstack/react-router";
import { ForbiddenScreen } from "@/screens/UtilityScreens";
export const Route = createFileRoute("/403")({
  head: () => ({ meta: [{ title: "No access — African Joy Dairy" }] }),
  component: ForbiddenScreen,
});
