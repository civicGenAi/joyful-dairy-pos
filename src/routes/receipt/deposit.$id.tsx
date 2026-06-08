import { createFileRoute } from "@tanstack/react-router";
import { DepositSlipPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/receipt/deposit/$id")({
  head: () => ({ meta: [{ title: "Deposit slip, African Joy Dairy" }] }),
  component: () => <RequireCap cap={["finance:read", "route:use"]}><DepositSlipPrintScreen /></RequireCap>,
});
