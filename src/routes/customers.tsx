import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const CustomersScreen = lazyScreen(
  () => import("@/screens/CustomersScreen"),
  "CustomersScreen",
);

export const Route = createFileRoute("/customers")({
  component: () => (
    <RequireCap cap="customers:read">
      <CustomersScreen />
    </RequireCap>
  ),
});
