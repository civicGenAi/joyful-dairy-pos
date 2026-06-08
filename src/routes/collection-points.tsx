import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const CollectionPointsScreen = lazyScreen(
  () => import("@/screens/CollectionPointsScreen"),
  "CollectionPointsScreen",
);

export const Route = createFileRoute("/collection-points")({
  component: () => (
    <RequireCap cap="collection:read">
      <CollectionPointsScreen />
    </RequireCap>
  ),
});
