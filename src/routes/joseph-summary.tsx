import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const JosephSummaryScreen = lazyScreen(
  () => import("@/screens/JosephSummaryScreen"),
  "JosephSummaryScreen",
);

export const Route = createFileRoute("/joseph-summary")({
  component: () => (
    <RequireCap cap="finance:read">
      <JosephSummaryScreen />
    </RequireCap>
  ),
});
