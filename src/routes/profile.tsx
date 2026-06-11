import { createFileRoute } from "@tanstack/react-router";
import { lazyScreen } from "@/components/shell/lazyScreen";

// Every signed-in user has a profile; AppShell handles the auth redirect.
const ProfileScreen = lazyScreen(() => import("@/screens/ProfileScreen"), "ProfileScreen");

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile, African Joy Dairy" }] }),
  component: ProfileScreen,
});
