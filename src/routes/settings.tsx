import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const SettingsScreen = lazyScreen(() => import("@/screens/SettingsScreen"), "SettingsScreen");

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireCap cap="settings:write">
      <SettingsScreen />
    </RequireCap>
  ),
});
