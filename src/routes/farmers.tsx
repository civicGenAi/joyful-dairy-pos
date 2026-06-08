import { createFileRoute } from "@tanstack/react-router";
import { FarmersScreen } from "@/screens/FarmersScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/farmers")({
  component: () => <RequireCap cap="farmers:read"><FarmersScreen /></RequireCap>,
});
