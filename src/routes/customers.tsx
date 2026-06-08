import { createFileRoute } from "@tanstack/react-router";
import { CustomersScreen } from "@/screens/CustomersScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/customers")({
  component: () => (
    <RequireCap cap="customers:read">
      <CustomersScreen />
    </RequireCap>
  ),
});
