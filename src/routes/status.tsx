import { createFileRoute } from "@tanstack/react-router";
import { StatusScreen } from "@/screens/StatusScreen";
export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "System status — African Joy Dairy" }] }),
  component: StatusScreen,
});
