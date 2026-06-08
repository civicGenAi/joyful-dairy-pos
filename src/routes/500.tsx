import { createFileRoute } from "@tanstack/react-router";
import { ServerErrorScreen } from "@/screens/UtilityScreens";
export const Route = createFileRoute("/500")({
  head: () => ({ meta: [{ title: "Server error, African Joy Dairy" }] }),
  component: ServerErrorScreen,
});
