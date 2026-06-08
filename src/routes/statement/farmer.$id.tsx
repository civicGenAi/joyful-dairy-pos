import { createFileRoute } from "@tanstack/react-router";
import { FarmerStatementPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/statement/farmer/$id")({
  head: () => ({ meta: [{ title: "Farmer statement, African Joy Dairy" }] }),
  component: () => (
    <RequireCap cap="farmers:read">
      <FarmerStatementPrintScreen />
    </RequireCap>
  ),
});
