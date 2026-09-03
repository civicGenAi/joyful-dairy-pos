import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const SalesDepositsScreen = lazyScreen(
  () => import("@/screens/SalesDepositsScreen"),
  "SalesDepositsScreen",
);

export const Route = createFileRoute("/sales-deposits")({
  component: () => (
    <RequireCap cap="finance:read">
      <SalesDepositsScreen />
    </RequireCap>
  ),
});
