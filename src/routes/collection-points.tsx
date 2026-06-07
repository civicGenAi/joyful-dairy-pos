import { createFileRoute } from "@tanstack/react-router";
import { CollectionPointsScreen } from "@/screens/CollectionPointsScreen";
export const Route = createFileRoute("/collection-points")({ component: CollectionPointsScreen });
