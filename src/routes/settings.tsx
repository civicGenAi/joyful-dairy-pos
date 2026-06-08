import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { RequireCap } from "@/components/shell/RequireCap";
export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireCap cap="settings:write">
      <SettingsScreen />
    </RequireCap>
  ),
});
