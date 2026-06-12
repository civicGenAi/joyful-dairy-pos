import { createFileRoute, redirect } from "@tanstack/react-router";

// Friendly alias: /health (and typos like /helth land on the 404 with a
// link) goes to the real health console at /status.
export const Route = createFileRoute("/health")({
  beforeLoad: () => {
    throw redirect({ to: "/status" });
  },
});
