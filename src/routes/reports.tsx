import { createFileRoute } from "@tanstack/react-router";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/reports")({
  component: () => <RequireCap cap="view:reports"><ReportsScreen /></RequireCap>,
});
