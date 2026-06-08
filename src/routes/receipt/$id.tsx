import { createFileRoute } from "@tanstack/react-router";
import { ReceiptPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";

export const Route = createFileRoute("/receipt/$id")({
  head: () => ({ meta: [{ title: "Receipt, African Joy Dairy" }] }),
  component: () => <RequireCap cap={["pos:use", "finance:read"]}><ReceiptPrintScreen /></RequireCap>,
});
