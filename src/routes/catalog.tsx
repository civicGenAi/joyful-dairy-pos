import { createFileRoute } from "@tanstack/react-router";
import { CatalogScreen } from "@/screens/CatalogScreen";

// Deliberately public, no RequireCap: what a customer's phone opens after
// scanning the "our products" QR code, they have no account.
export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Products, African Joy Dairy" }] }),
  component: CatalogScreen,
});
