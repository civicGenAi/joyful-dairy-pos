import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const MpesaSalesScreen = lazyScreen(() => import("@/screens/MpesaSalesScreen"), "MpesaSalesScreen");

export const Route = createFileRoute("/mpesa-sales")({
  component: () => (
    <RequireCap cap="finance:read">
      <MpesaSalesScreen />
    </RequireCap>
  ),
});
