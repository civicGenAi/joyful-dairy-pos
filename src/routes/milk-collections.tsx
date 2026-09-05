import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const MilkCollectionsScreen = lazyScreen(
  () => import("@/screens/MilkCollectionsScreen"),
  "MilkCollectionsScreen",
);

export const Route = createFileRoute("/milk-collections")({
  component: () => (
    <RequireCap cap="collection:read">
      <MilkCollectionsScreen />
    </RequireCap>
  ),
});
