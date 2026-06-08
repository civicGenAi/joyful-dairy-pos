import { createFileRoute } from "@tanstack/react-router";
import { lazyScreen } from "@/components/shell/lazyScreen";

const HelpScreen = lazyScreen(() => import("@/screens/HelpScreen"), "HelpScreen");

export const Route = createFileRoute("/help")({
  component: HelpScreen,
});
