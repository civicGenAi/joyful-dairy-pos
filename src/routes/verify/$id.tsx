import { createFileRoute } from "@tanstack/react-router";
import { VerifyInvoiceScreen } from "@/screens/VerifyInvoiceScreen";

// Deliberately public, no RequireCap: this is what a customer's phone
// opens by scanning the QR code on a printed invoice, they have no account.
export const Route = createFileRoute("/verify/$id")({
  head: () => ({ meta: [{ title: "Verify invoice, African Joy Dairy" }] }),
  component: VerifyInvoiceScreen,
});
