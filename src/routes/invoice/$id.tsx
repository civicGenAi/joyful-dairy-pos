import { createFileRoute } from "@tanstack/react-router";
import { InvoicePrintScreen } from "@/screens/InvoiceLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/invoice/$id")({
  head: () => ({ meta: [{ title: "Invoice, African Joy Dairy" }] }),
  component: () => (
    <RequireCap cap={["customers:read", "finance:read"]}>
      <InvoicePrintScreen />
    </RequireCap>
  ),
});
