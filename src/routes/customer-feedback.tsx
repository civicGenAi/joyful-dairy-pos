import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const CustomerFeedbackScreen = lazyScreen(
  () => import("@/screens/CustomerFeedbackScreen"),
  "CustomerFeedbackScreen",
);

export const Route = createFileRoute("/customer-feedback")({
  component: () => (
    <RequireCap cap="view:reports">
      <CustomerFeedbackScreen />
    </RequireCap>
  ),
});
