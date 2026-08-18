import { createFileRoute } from "@tanstack/react-router";
import { FeedbackFormScreen } from "@/screens/FeedbackFormScreen";

// Deliberately public, no RequireCap: this is what a customer's phone opens
// after scanning the feedback QR code, they have no account.
export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Feedback, African Joy Dairy" }] }),
  component: FeedbackFormScreen,
});
