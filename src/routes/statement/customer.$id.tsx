import { createFileRoute } from "@tanstack/react-router";
import { CustomerStatementPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/statement/customer/$id")({
  head: () => ({ meta: [{ title: "Customer statement, African Joy Dairy" }] }),
  component: () => <RequireCap cap="customers:read"><CustomerStatementPrintScreen /></RequireCap>,
});
