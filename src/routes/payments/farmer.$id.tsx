import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const FarmerPaymentsScreen = lazyScreen(
  () => import("@/screens/FarmerPaymentsScreen"),
  "FarmerPaymentsScreen",
);

export const Route = createFileRoute("/payments/farmer/$id")({
  head: () => ({ meta: [{ title: "Farmer payments, African Joy Dairy" }] }),
  component: () => (
    <RequireCap cap="farmers:read">
      <FarmerPaymentsScreen />
    </RequireCap>
  ),
});
