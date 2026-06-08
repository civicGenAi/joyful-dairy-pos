import { createFileRoute } from "@tanstack/react-router";
import { POSScreen } from "@/screens/POSScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/pos")({
  component: () => (
    <RequireCap cap="pos:use">
      <POSScreen />
    </RequireCap>
  ),
});
