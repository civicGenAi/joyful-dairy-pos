import { createFileRoute } from "@tanstack/react-router";
import { CollectionPointsScreen } from "@/screens/CollectionPointsScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/collection-points")({
  component: () => <RequireCap cap="collection:read"><CollectionPointsScreen /></RequireCap>,
});
