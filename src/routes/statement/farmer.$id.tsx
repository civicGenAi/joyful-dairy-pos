import { createFileRoute } from "@tanstack/react-router";
import { FarmerStatementPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";
import { z } from "zod";

const searchSchema = z.object({
  /** ISO date of the first day of the month to show; defaults to the
   *  current month when omitted. */
  month: z.string().optional(),
});

export const Route = createFileRoute("/statement/farmer/$id")({
  head: () => ({ meta: [{ title: "Farmer statement, African Joy Dairy" }] }),
  validateSearch: searchSchema,
  component: () => (
    <RequireCap cap="farmers:read">
      <FarmerStatementPrintScreen />
    </RequireCap>
  ),
});
